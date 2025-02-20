import PropTypes from "prop-types";
import { useEffect, useState } from "react";

const DraggableList = ({
  items,
  onOrderUpdate,
  ItemTemplate,
  templateArgs,
}) => {
  const [draggingItem, setDraggingItem] = useState();
  const [itemsList, setItemsList] = useState(items);

  useEffect(() => {
    setItemsList(items);
  }, [items]);

  const handleDragStart = (e, index) => {
    setDraggingItem(index);
    e.dataTransfer["text/plain"] = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, index) => {
    e.preventDefault();

    // if dropping onto itself, dont do anything
    if (draggingItem === null || draggingItem === index) return;

    // update the order of the items based on the item index
    const updatedItems = [...items];
    const movedItem = updatedItems.splice(draggingItem, 1)[0];
    updatedItems.splice(index, 0, movedItem);

    // update states accordingly
    if (onOrderUpdate) {
      onOrderUpdate(updatedItems);
    }
    setItemsList(updatedItems);
    setDraggingItem(null);
  };

  return (
    <>
      {itemsList.map((value, index) => {
        const draggingProps = {
          onDragStart: (e) => handleDragStart(e, index),
          onDragOver: handleDragOver,
          onDrop: (e) => handleDrop(e, index),
          draggable: "true",
        };
        if (ItemTemplate) {
          return (
            <ItemTemplate
              key={index}
              value={value}
              index={index}
              draggingProps={draggingProps}
              {...templateArgs}
            />
          );
        } else {
          return (
            <div key={index} {...draggingProps}>
              {value}
            </div>
          );
        }
      })}
    </>
  );
};

DraggableList.propTypes = {
  items: PropTypes.array.isRequired, // array of data, configurations, values, components, etc
  onOrderUpdate: PropTypes.func, // callback funtion for when items update the order
  ItemTemplate: PropTypes.func, // react component template for list items if more customization is needed
  templateArgs: PropTypes.object, // additional args to pass to the item template
};

export default DraggableList;
