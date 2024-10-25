import styled from "styled-components";
import LoadingAnimation from "./LoadingAnimation";

const StyledSpinner = styled(LoadingAnimation)`
  /* Define CSS variables at the root of the component */
  --bs-primary: #0a62a9;
  --center: translate(-50%, -50%);
  --center-dia: 10%;
  --inner-spin: 15s;
  --inner-arc-dia: 40%;
  --inner-moon-dia: 5%;
  --inner-moon-orbit: 20%;
  --outer-spin: 13s;
  --outer-arc-dia: 70%;
  --outer-moon-dia: 8%;
  --outer-moon-orbit: 35%;

  /* Adjust the container */
  position: relative;
  width: 50%;
  height: 50%;
  margin: 25% auto;

  /* Loading Text */
  .loading-text {
    position: absolute;
    top: 70%;
    left: 0;
    width: 100%;
    text-align: center;
    font-size: 2vw;
    color: var(--bs-primary);
  }

  /* Center Circle */
  .center {
    position: absolute;
    width: var(--center-dia);
    height: var(--center-dia);
    background: var(--bs-primary);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: var(--center);
  }

  /* Spinner Positions */
  .outer-spin,
  .inner-spin {
    position: absolute;
    top: 50%;
    left: 50%;
  }

  /* Animations */
  .outer-spin {
    animation: revspin var(--outer-spin) linear infinite;
  }

  .inner-spin {
    animation: spin var(--inner-spin) linear infinite;
  }

  /* Arcs */
  .outer-arc,
  .inner-arc {
    position: absolute;
    border-radius: 50%;
    border: 0.5% solid;
  }

  .outer-arc {
    width: var(--outer-arc-dia);
    height: var(--outer-arc-dia);
  }

  .inner-arc {
    width: var(--inner-arc-dia);
    height: var(--inner-arc-dia);
  }

  /* Outer Arcs */
  .outer-arc_start-a {
    border-color: transparent transparent transparent var(--bs-primary);
    transform: var(--center) rotate(55deg);
  }

  .outer-arc_end-a {
    border-color: var(--bs-primary) transparent transparent transparent;
    transform: var(--center) rotate(35deg);
  }

  .outer-arc_start-b {
    border-color: transparent transparent transparent var(--bs-primary);
    transform: var(--center) rotate(55deg) scale(-1, -1);
  }

  .outer-arc_end-b {
    border-color: var(--bs-primary) transparent transparent transparent;
    transform: var(--center) rotate(35deg) scale(-1, -1);
  }

  /* Outer Moons */
  .outer-moon-a,
  .outer-moon-b {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--outer-moon-dia);
    height: var(--outer-moon-dia);
    background: var(--bs-primary);
    border-radius: 50%;
  }

  .outer-moon-a {
    transform: var(--center) translate(var(--outer-moon-orbit), 0);
  }

  .outer-moon-b {
    transform: var(--center) translate(calc(-1 * var(--outer-moon-orbit)), 0);
  }

  /* Inner Arcs */
  .inner-arc_start-a {
    border-color: transparent transparent transparent var(--bs-primary);
    transform: var(--center) rotate(60deg);
  }

  .inner-arc_end-a {
    border-color: var(--bs-primary) transparent transparent transparent;
    transform: var(--center) rotate(30deg);
  }

  .inner-arc_start-b {
    border-color: transparent transparent transparent var(--bs-primary);
    transform: var(--center) rotate(60deg) scale(-1, -1);
  }

  .inner-arc_end-b {
    border-color: var(--bs-primary) transparent transparent transparent;
    transform: var(--center) rotate(30deg) scale(-1, -1);
  }

  /* Inner Moons */
  .inner-moon-a,
  .inner-moon-b {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--inner-moon-dia);
    height: var(--inner-moon-dia);
    background: var(--bs-primary);
    border-radius: 50%;
  }

  .inner-moon-a {
    transform: var(--center) translate(var(--inner-moon-orbit), 0);
  }

  .inner-moon-b {
    transform: var(--center) translate(calc(-1 * var(--inner-moon-orbit)), 0);
  }

  /* Keyframes */
  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes revspin {
    100% {
      transform: rotate(-360deg);
    }
  }
`;

export default StyledSpinner;