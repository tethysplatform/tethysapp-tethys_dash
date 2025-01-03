import React, { useEffect, useState } from "react";
import styled from "styled-components";

const StyledDiv = styled.div`
  overflow-x: auto;
`;

const DraggableList = ({ items, onOrderUpdate, itemTemplate }) => {
  const [draggingItem, setDraggingItem] = useState();
  const [itemsList, setItemsList] = useState(items);

  useEffect(() => {
    setItemsList(items);
  }, [items]);

  const handleDragStart = (e, item) => {
    setDraggingItem(item);
    e.dataTransfer.setData("text/plain", "");
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetItem) => {
    if (!draggingItem) return;

    const currentIndex = itemsList.indexOf(draggingItem);
    const targetIndex = itemsList.indexOf(targetItem);

    if (currentIndex !== -1 && targetIndex !== -1) {
      itemsList.splice(currentIndex, 1);
      itemsList.splice(targetIndex, 0, draggingItem);
    }
    onOrderUpdate(itemsList);
  };

  return (
    <>
      {itemsList.map((value, index) => {
        const draggingProps = {
          key: index,
          onDragStart: (e) => handleDragStart(e, value),
          onDragEnd: handleDragEnd,
          onDragOver: handleDragOver,
          onDrop: (e) => handleDrop(e, value),
          draggable: "true",
        };

        return itemTemplate({ value, index, draggingProps });
      })}
    </>
  );
};

export default DraggableList;
