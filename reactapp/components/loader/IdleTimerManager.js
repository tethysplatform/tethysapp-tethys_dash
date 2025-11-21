import { useState, useEffect, useRef, memo } from "react";
import { Confirmation } from "components/inputs/Confirmation";
import Form from "react-bootstrap/Form";
import { getTethysPortalBase } from "services/utilities";
import PropTypes from "prop-types";
import { useIdleTimer } from "react-idle-timer";
import appAPI from "services/api/app";
import tethysAPI from "services/api/tethys";
import { useModalPriority } from "components/contexts/ModalPriorityContext";

// This controls how often the API is called for activity
const SESSION_PING_FREQUENCY = process.env.REACT_SESSION_PING_FREQUENCY;

function IdleTimerManager() {
  const {
    setShowingPublicUserModal,
    setPublicUserModalChecked,
    setShowingIdleTimeoutModal,
    appInfoModalWasOpen,
    setAppInfoModalWasOpen,
  } = useModalPriority();
  const [showRedirectPublicUserModal, setShowRedirectPublicUserModal] =
    useState(false);
  const [checked, setChecked] = useState(false);
  const [showActivePrompt, setShowActivePrompt] = useState(false);
  const [sessionSecurityWarn, setSessionSecurityWarn] = useState(540);
  const [sessionSecurityExpire, setSessionSecurityExpire] = useState(600);
  const [remaining, setRemaining] = useState(sessionSecurityWarn);
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);
  const lastCountRef = useRef(0);
  const renderedOnce = useRef(false);
  const [count, setCount] = useState(0);

  const dontShowPublicLoginOnStart = localStorage.getItem(
    "dontShowPublicLoginOnStart"
  );
  const TETHYS_PORTAL_BASE = getTethysPortalBase();

  useEffect(() => {
    const loadAppData = async () => {
      try {
        await tethysAPI.getSession();
        // User is authenticated, no need to show public user modal
        setPublicUserModalChecked(true);
      } catch (error) {
        if (error.response.status === 401) {
          if (
            dontShowPublicLoginOnStart === "false" ||
            !dontShowPublicLoginOnStart
          ) {
            setShowRedirectPublicUserModal(true);
            setShowingPublicUserModal(true);
          }
          // Mark as checked even if not showing (user has opted out)
          setPublicUserModalChecked(true);
        }
      }
    };

    loadAppData();

    // eslint-disable-next-line
  }, []);

  const onAction = (event) => {
    setCount((prevCount) => {
      return prevCount + 1;
    });
  };

  const onIdle = async () => {
    // First, ensure the session is ended on the backend
    try {
      await appAPI.getActivityData({ idleFor: sessionSecurityExpire + 1 });
    } catch (error) {
      // Ignore errors, we're logging out anyway
    }
    // Then redirect to logout, which will then redirect to login
    window.location.assign(
      `${TETHYS_PORTAL_BASE}/accounts/logout/?next=${TETHYS_PORTAL_BASE}/accounts/login?next=${window.location.pathname}`
    );
    setShowActivePrompt(false);
  };

  const onActive = () => {
    setRemaining(sessionSecurityWarn);
    setShowActivePrompt(false);
  };

  const onPrompt = () => {
    setCount(0);
    setShowActivePrompt(true);
    setShowingIdleTimeoutModal(true);
  };

  const { getRemainingTime, activate, pause } = useIdleTimer({
    disabled: !isTimerEnabled,
    onActive,
    onAction,
    onIdle,
    onPrompt,
    timeout: 1000 * sessionSecurityExpire,
    throttle: 1000 * SESSION_PING_FREQUENCY, // This controls how often the API is called for activity
    promptBeforeIdle: 1000 * (sessionSecurityExpire - sessionSecurityWarn),
  });

  useEffect(() => {
    if (!isTimerEnabled) return;

    const interval = setInterval(() => {
      if (showActivePrompt) {
        setRemaining(Math.ceil(getRemainingTime() / 1000));
      }
    }, 500);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line
  }, [isTimerEnabled, showActivePrompt]);

  useEffect(() => {
    lastCountRef.current = count;
    const callAPI = async () => {
      try {
        const idleFor = 0;
        const response = await appAPI.getActivityData({ idleFor });

        if (response.status === -2) {
          // The user has been signed out
          window.location.assign(
            `${TETHYS_PORTAL_BASE}/accounts/login?next=${window.location.pathname}`
          );
        } else if (response.status === 2 || response.status === -1) {
          // (2) Pause the IdleTimer as it's not going to do anything for a public user
          // (-1) Also pauses if the user doesn't have a session security in the first place
          // aka django-session-security not being installed.
          pause();
        }
        if (!renderedOnce.current) {
          renderedOnce.current = true;
          if (parseInt(response.EXPIRE_AFTER) === 0) {
            setIsTimerEnabled(false);
          } else {
            setSessionSecurityExpire(response.EXPIRE_AFTER);
            setSessionSecurityWarn(response.WARN_AFTER);
            setRemaining(response.WARN_AFTER);
          }
        }
      } catch (error) {
        console.error("API call failed:", error);
      }
    };

    if (count > 0) {
      callAPI();
    } else if (count === 0 && renderedOnce.current === false) {
      // Initial load
      callAPI();
    }
    // eslint-disable-next-line
  }, [count]);

  const handleDontShow = (e) => {
    setChecked(e.target.checked);
    localStorage.setItem("dontShowPublicLoginOnStart", e.target.checked);
  };

  const handlePublicUser = (confirmation) => {
    if (!confirmation) {
      window.location.assign(
        `${TETHYS_PORTAL_BASE}/accounts/login?next=${window.location.pathname}`
      );
      return;
    }
    setShowRedirectPublicUserModal(false);
    setShowingPublicUserModal(false);
  };

  const handleStillHere = (active) => {
    if (active) {
      // Increment count to trigger API call to keep session alive
      setCount((prevCount) => prevCount + 1);
      onActive();
      activate();
      setShowingIdleTimeoutModal(false);
      // Reopen AppInfo modal if it was open before
      if (appInfoModalWasOpen) {
        // Small delay to ensure smooth transition
        setTimeout(() => {
          setAppInfoModalWasOpen(true); // Keep it true to trigger reopening in Header
        }, 100);
      }
    }
  };

  if (showRedirectPublicUserModal) {
    return (
      <Confirmation
        show={showRedirectPublicUserModal}
        okLabel="Proceed Without Signing in"
        cancelLabel="Sign in"
        title="Public User Login"
        confirmation={
          <>
            <div>
              You are not signed in. Sign in to create and update dashboards.
            </div>
            <div style={{ marginTop: ".75rem" }}>
              If you'd like to continue, you will only have access to public
              dashboards
            </div>
            <Form.Check
              onChange={handleDontShow}
              type="checkbox"
              label="Don't show on startup"
              checked={checked}
              aria-label="dont-show-public-user-on-startup"
              style={{ marginTop: ".75rem" }}
            />
          </>
        }
        proceed={handlePublicUser}
        backdrop={"static"}
      />
    );
  } else {
    return (
      <Confirmation
        show={showActivePrompt}
        okLabel="Stay Signed In"
        cancelLabel="Sign out"
        title="Are you still here?"
        confirmation={
          <>
            <div style={{ marginTop: ".75rem" }}>
              {/* remaining - 1 to kinda fake the timer
                      since there's a race condition with the backend logout */}
              Logging out in {remaining - 1} seconds.
            </div>
          </>
        }
        proceed={handleStillHere}
        backdrop={"static"}
        noCancel
      />
    );
  }
}

IdleTimerManager.propTypes = {
  sessionSecurityWarn: PropTypes.number,
  sessionSecurityExpire: PropTypes.number,
  isTimerEnabled: PropTypes.bool,
  onSessionExpire: PropTypes.func,
};

export default memo(IdleTimerManager);
