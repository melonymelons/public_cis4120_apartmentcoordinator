import React, { useRef } from 'react';
import ApartmentMap from './ApartmentMap';
import Icon from './Icons';
import { SupplyIcon } from './SupplyQuantity';
import { hasQuantity } from './inventory';

export default function ItemPlacement({ room, item, inventory, objects, tasks, people, position, onPosition, onDragging }) {
  const layer = useRef(null), gesture = useRef(null);
  const bounded = point => ({ x: Math.max(10, Math.min(90, point.x)), y: Math.max(18, Math.min(88, point.y)) });
  function end(event) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    if (event.type === 'pointercancel' || event.type === 'lostpointercapture') onPosition(drag.before);
    gesture.current = null;
    onDragging(false);
  }
  return <>
    <p className="object-placement-hint"><Icon name="drag" size={15}/>Drag {item.name} into place</p>
    <div className="object-placement-board room-focus-map is-items-focused" style={{ '--room-aspect': room.w / room.h }}>
      <div className="object-placement-preview" inert aria-hidden="true"><ApartmentMap rooms={[{ ...room, x: 0, y: 0 }]} grid={{ cols: room.w, rows: room.h }} objects={objects.filter(object => object.roomId === room.id)} tasks={tasks} inventory={inventory.filter(other => other.id !== item.id && other.roomId === room.id)} people={people}/></div>
      <div ref={layer} className="room-supply-layer item-placement-layer">
        <button type="button" className="supply-map-pin inventory-marker placement-marker" aria-label={`Position ${item.name}`} aria-describedby="item-placement-help" style={{ left: `${position.x}%`, top: `${position.y}%` }}
          onPointerDown={event => {
            if (event.button !== 0 || gesture.current) return;
            event.preventDefault(); event.stopPropagation();
            event.currentTarget.focus({ preventScroll: true });
            const rect = layer.current.getBoundingClientRect();
            gesture.current = { id: event.pointerId, before: position, dx: (event.clientX - rect.left) / rect.width * 100 - position.x, dy: (event.clientY - rect.top) / rect.height * 100 - position.y };
            event.currentTarget.setPointerCapture(event.pointerId);
            onDragging(true);
          }} onPointerMove={event => {
            const drag = gesture.current;
            if (!drag || drag.id !== event.pointerId) return;
            const rect = layer.current.getBoundingClientRect();
            onPosition(bounded({ x: (event.clientX - rect.left) / rect.width * 100 - drag.dx, y: (event.clientY - rect.top) / rect.height * 100 - drag.dy }));
          }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
          onKeyDown={event => {
            const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
            if (!delta) return;
            event.preventDefault();
            const step = event.shiftKey ? 8 : 2;
            onPosition(bounded({ x: position.x + delta[0] * step, y: position.y + delta[1] * step }));
          }}><SupplyIcon item={item} size={24}/><span className="supply-map-count">{hasQuantity(item) ? item.quantity : '?'}</span></button>
      </div>
    </div>
    <span className="sr-only" id="item-placement-help">Drag to place the item. Use arrow keys for small adjustments, or Shift and arrow keys for larger adjustments.</span>
  </>;
}
