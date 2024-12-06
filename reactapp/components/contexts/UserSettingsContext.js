import PropTypes from "prop-types";
import appAPI from "services/api/app";
import { AppContext } from "components/contexts/Contexts";
import { useContext, useEffect, createContext, useState } from "react";

export const UserSettingsContext = createContext();

const UserSettingsContextProvider = ({ children }) => {
  const [userSettings, setUserSettings] = useState({});
  const { csrf } = useContext(AppContext);

  useEffect(() => {
    appAPI.getUserSettings().then((data) => {
      setUserSettings(data);
    });
    // eslint-disable-next-line
  }, []);

  async function updateUserSettings(updatedProperties) {
    const updatedUserSettings = {
      ...userSettings,
      ...updatedProperties,
    };
    const apiResponse = await appAPI.updateUserSettings(
      updatedUserSettings,
      csrf
    );
    if (apiResponse["success"]) {
      setUserSettings(updatedUserSettings);
    }
    return apiResponse;
  }

  return (
    <UserSettingsContext.Provider value={{ userSettings, updateUserSettings }}>
      {children}
    </UserSettingsContext.Provider>
  );
};

UserSettingsContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default UserSettingsContextProvider;

export const useUserSettingsContext = () => {
  return useContext(UserSettingsContext);
};
