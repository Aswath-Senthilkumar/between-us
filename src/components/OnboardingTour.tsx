import { useState, useEffect } from "react";
import Joyride, { STATUS } from "react-joyride";
import type { Step, CallBackProps } from "react-joyride";
import { useAuth } from "../context/useAuth";

// Custom styles for sketched/wobbly look
const tourStyles = {
  options: {
    arrowColor: "#fff",
    backgroundColor: "#fff",
    overlayColor: "rgba(0, 0, 0, 0.4)",
    primaryColor: "#cfebff", // accent-blue
    textColor: "#2b2b2b", // ink
    width: 350,
    zIndex: 1000,
  },
  tooltip: {
    borderRadius: "2px 255px 3px 25px / 255px 5px 225px 5px", // Sketched border radius
    border: "2px solid #2b2b2b",
    fontFamily: '"Patrick Hand", cursive',
    fontSize: "1.2rem",
    padding: "20px",
    boxShadow: "5px 8px 15px rgba(0,0,0,0.15)",
  },
  buttonNext: {
    backgroundColor: "#e0fadd", // accent-green
    border: "2px solid #2b2b2b",
    borderRadius: "255px 15px 225px 15px / 15px 225px 15px 255px",
    color: "#2b2b2b",
    fontFamily: '"Patrick Hand", cursive',
    fontSize: "1rem",
    fontWeight: "bold",
    padding: "8px 16px",
    outline: "none",
  },
  buttonBack: {
    color: "#2b2b2b",
    fontFamily: '"Patrick Hand", cursive',
    marginRight: 10,
  },
  buttonSkip: {
    color: "#999",
    fontFamily: '"Patrick Hand", cursive',
  },
};

interface OnboardingTourProps {
  run: boolean;
  steps: Step[];
  onFinish?: () => void;
  onStepChange?: (data: CallBackProps) => void;
}

export default function OnboardingTour({
  run,
  steps,
  onFinish,
  onStepChange,
}: OnboardingTourProps) {
  const { profile } = useAuth();
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    if (run && profile) {
      // Delay slightly to avoid synchronous state update warning during render
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [run, profile]);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    if (onStepChange) onStepChange(data);

    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      if (onFinish) onFinish();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={runTour}
      continuous
      showSkipButton
      showProgress
      styles={tourStyles}
      callback={handleJoyrideCallback}
      locale={{
        last: "Let's Play!",
        skip: "Skip Intro",
      }}
    />
  );
}
