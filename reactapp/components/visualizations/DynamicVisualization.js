import React, { Suspense, lazy } from 'react';

// DynamicLoader Component for npm library components
const DynamicVisualization = ({ packageName, componentName, componentProps }) => {
  // Dynamically import the package and resolve the named export
//   const Component = lazy(() =>
//     import(`${packageName}`).then((module) => ({ default: module[componentName] }))
//   );
  console.log(packageName);
  const Component = lazy(async () => {
    const module = await import(
      /* webpackMode: "eager" */
      `${packageName}`
    );   
    return { default: module[`${componentName}`] };
  });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Component {...componentProps} />
    </Suspense>
  );
};

export default DynamicVisualization;

// const Icon = lazy(async () => {
//     const module = await import(`react-icons/fa`);   
//     return { default: module['FaAccessibleIcon'] };
//   });

//   export default Icon;