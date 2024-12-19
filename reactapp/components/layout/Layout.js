import { Route, Routes } from "react-router-dom";
import PropTypes from "prop-types";

import LoadingAnimation from "components/loader/LoadingAnimation";
import NotFound from "components/error/NotFound";
import { useRoutesContext } from "components/contexts/RoutesContext";

function Layout({ children }) {
  const { routes } = useRoutesContext();

  return (
    <div className="h-100">
      <Routes>
        {routes}
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
