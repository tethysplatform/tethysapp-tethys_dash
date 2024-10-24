import { Route, Routes } from "react-router-dom";
import PropTypes from "prop-types";

import Header from "components/layout/Header";
import LoadingAnimation from "components/loader/LoadingAnimation";
import NotFound from "components/error/NotFound";
import { useRoutesContext } from "components/contexts/RoutesContext";

function Layout({ children }) {
  const routes = useRoutesContext()[0];

  return (
    <div className="h-100">
      <Routes>
        {routes}
        <Route path="/dashboard/*" element={<LoadingAnimation />} />
        <Route path="*" element={<NotFound />} />
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
