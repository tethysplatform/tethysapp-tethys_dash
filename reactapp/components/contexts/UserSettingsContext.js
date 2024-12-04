import PropTypes from "prop-types";
import appAPI from "services/api/app";
import { useContext, useEffect, createContext, useState } from "react";

export const UserSettingsContext = createContext();

const UserSettingsContextProvider = ({ children }) => {
  const [userSettings, setUserSettings] = useState([]);

  useEffect(() => {
    appAPI.getUserSettings().then((data) => {
      setUserSettings(data);
    });
    // eslint-disable-next-line
  }, []);

  return (
    <UserSettingsContext.Provider value={{ userSettings }}>
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
