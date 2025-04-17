import { useEffect, useRef, useState } from "react";

const useHighestZIndex = (eId?: string) => {
  const zIndex = useRef<number>(0);
  const [zi, setZI] = useState(0);

  const serachHighestZindex = (element: HTMLElement) => {
    if (
      element.style.zIndex &&
      !isNaN(Number(element.style.zIndex)) &&
      Number(element.style.zIndex) > zIndex.current
    ) {
      zIndex.current = Number(element.style.zIndex);
    }
    if (element.nodeName === "DIV" && element.children.length > 0) {
      for (let child of element.children) {
        serachHighestZindex(child as HTMLElement);
      }
    }
  };
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (eId) {
        // Get all elements with the specified class name
        const element = document.getElementById(eId);

        if (element) {
          serachHighestZindex(element);
        }
        setZI(zIndex.current == 0 ? 1 : zIndex.current);
      } else {
        serachHighestZindex(document.body);
        setZI(zIndex.current == 0 ? 1 : zIndex.current);
      }
    }
  }, [eId]);

  return zi;
};
export default useHighestZIndex;
