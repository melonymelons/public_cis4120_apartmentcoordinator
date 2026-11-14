import React, { useLayoutEffect, useRef, useState } from 'react';
import { restockTasksForItem } from './inventory';

export default function RestockConnections({ items, objects, tasks }) {
  const svg = useRef(null);
  const [lines, setLines] = useState([]);
  useLayoutEffect(() => {
    const room = svg.current.parentElement;
    function measure() {
      const bounds = room.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const center = element => {
        const rect = element.getBoundingClientRect();
        return { x: (rect.left + rect.width / 2 - bounds.left) / bounds.width * 100, y: (rect.top + rect.height / 2 - bounds.top) / bounds.height * 100 };
      };
      setLines(items.flatMap(item => {
        const task = restockTasksForItem(item, tasks).find(task => objects.some(object => object.id === task.objectId && object.roomId === item.roomId));
        if (!task) return [];
        const from = room.querySelector(`[data-item="${CSS.escape(item.id)}"]`);
        const to = room.querySelector(`[data-object="${CSS.escape(task.objectId)}"]`);
        return from && to ? [{ id: item.id, objectId: task.objectId, from: center(from), to: center(to) }] : [];
      }));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(room);
    room.querySelectorAll('.object-pin,.supply-map-pin').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [items, objects, tasks]);
  return <svg ref={svg} className="restock-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    {lines.map(line => <line key={line.id} data-linked-item={line.id} data-linked-object={line.objectId} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}/>)}
  </svg>;
}
