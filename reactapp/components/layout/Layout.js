import { Route, Routes } from "react-router-dom";
import PropTypes from "prop-types";
import { useContext } from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import NotFound from "components/error/NotFound";
import { RoutesContext } from "components/contexts/Contexts";

function Layout({ children }) {
  const appRoutes = useContext(RoutesContext);

  return (
    <div className="h-100">
      <Routes>
        {appRoutes}
        <Route
          key="route-dashboard-loading"
          path="/dashboard/*"
          element={<LoadingAnimation />}
        />
        <Route key="route-not-found" path="*" element={<NotFound />} />
      </Routes>
      {children}
    </div>
  );
}

Layout.propTypes = {
  navLinks: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string,
      to: PropTypes.string,
      eventKey: PropTypes.string,
    })
  ),
  routes: PropTypes.arrayOf(PropTypes.node),
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
  ]),
};

export default Layout;
