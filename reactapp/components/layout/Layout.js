import { Route, Routes } from "react-router-dom";
import PropTypes from "prop-types";

import Header from "components/layout/Header";
import NotFound from "components/error/NotFound";

function Layout({ routes, children }) {
  return (
    <div className="h-100">
      <Header />
      <Routes>
        {routes}
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
