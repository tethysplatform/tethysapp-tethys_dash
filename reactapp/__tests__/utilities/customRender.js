import PropTypes from "prop-types";
import { useContext, useEffect } from "react";
import { mockedDashboards } from "__tests__/utilities/constants";
import DashboardLoader from "components/loader/DashboardLoader";
import Loader from "components/loader/AppLoader";
import {
  LayoutContext,
  EditingContext,
  DataViewerModeContext,
  VariableInputsContext,
  DisabledEditingMovementContext,
} from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";

const TestingComponent = ({ children, options = {} }) => {
  const { setIsEditing } = useContext(EditingContext);
  const { setInDataViewerMode } = useContext(DataViewerModeContext);
  const { setActiveAppTour, setAppTourStep } = useAppTourContext();

  useEffect(() => {
    if (options.inEditing) {
      setIsEditing(true);
    }

    if (options.inDataViewerMode) {
      setInDataViewerMode(true);
    }

    if (options.inAppTour) {
      setActiveAppTour(true);
      setAppTourStep(options.appTourStep);
    }
    // eslint-disable-next-line
  }, []);

  return <>{children}</>;
};

const createLoadedComponent = ({ children, options = {} }) => {
  const dashboards = options.dashboards ?? mockedDashboards;
  const initialDashboard = options.initialDashboard ?? dashboards.user[0];

  if (options.user) {
    server.use(
      rest.get("http://api.test/api/whoami/", (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            username: options.user.username ?? "jsmith",
            firstName: "John",
            lastName: "Smith",
            email: "jsmith@tethys.org",
            isAuthenticated: options.user.isAuthenticated ?? true,
            isStaff: options.user.isStaff ?? true,
          }),
          ctx.set("Content-Type", "application/json")
        );
      })
    );
  }

  if (options.dashboards || options.initialDashboard) {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/dashboards/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(dashboards),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/dashboards/get/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({ success: true, dashboard: initialDashboard }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );
  }

  if (options.visualizations) {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/visualizations/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              visualizations: options.visualizations,
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );
  }

  return (
    <Loader>
      <DashboardLoader
        editable={options.editableDashboard}
        {...initialDashboard}
      >
        <TestingComponent options={options}>{children}</TestingComponent>
      </DashboardLoader>
    </Loader>
  );
};

export const ContextLayoutPComponent = () => {
  const { getDashboardMetadata } = useContext(LayoutContext);

  return (
    <p data-testid="layout-context">{JSON.stringify(getDashboardMetadata())}</p>
  );
};

export const EditingPComponent = () => {
  const { isEditing } = useContext(EditingContext);

  return <p data-testid="editing">{isEditing ? "editing" : "not editing"}</p>;
};

export const DisabledMovementPComponent = () => {
  const { disabledEditingMovement } = useContext(
    DisabledEditingMovementContext
  );

  return (
    <p data-testid="disabledMovement">
      {disabledEditingMovement ? "disabled movement" : "allowed movement"}
    </p>
  );
};

export const DataViewerPComponent = () => {
  const { inDataViewerMode } = useContext(DataViewerModeContext);

  return (
    <p data-testid="dataviewer-mode">
      {inDataViewerMode ? "dataviewer-mode" : "not in dataviewer-mode"}
    </p>
  );
};

export const InputVariablePComponent = () => {
  const { variableInputValues } = useContext(VariableInputsContext);

  return (
    <p data-testid="input-variables">{JSON.stringify(variableInputValues)}</p>
  );
};

TestingComponent.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
  ]),
  options: PropTypes.object,
};

export default createLoadedComponent;
