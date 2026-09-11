/**
 * KanbanBoard.jsx
 * ---------------------------------------------------------------------
 * PURPOSE
 *   One drag-and-drop board implementation shared by three sections
 *   (Leads, Projects, Tasks) instead of three separate DnD
 *   implementations. Each section just supplies:
 *     - `columns`: [{ id: 'new', label: 'New' }, ...]
 *     - `itemsByColumn`: { new: [...], contacted: [...] }
 *     - `renderCard(item)`: JSX for one card
 *     - `onMove(itemId, newStatus, newIndex)`: called after a drop
 *
 * HOW THE DRAG LOGIC WORKS (dnd-kit)
 *   Every card is draggable (useSortable). Every column is also a drop
 *   target. On drag end we figure out which column the card was
 *   dropped into (either directly onto the column, or onto another
 *   card -- in which case we use THAT card's column) and at what index,
 *   update local state immediately for a snappy feel, then call
 *   `onMove` so the parent persists it to the backend.
 */

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function SortableCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'dragging-ghost' : ''}
    >
      {children}
    </div>
  );
}

function Column({ column, items, renderCard, count }) {
  const { setNodeRef } = useDroppable({ id: `column:${column.id}` });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-canvas-muted dark:bg-canvas-dark-muted">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-sm font-semibold text-ink dark:text-ink-invert">{column.label}</span>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-soft dark:bg-canvas-dark dark:text-ink-invert/60">
          {count}
        </span>
      </div>
      <div ref={setNodeRef} className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-3">
        <SortableContext items={items.map((i) => `card:${i.id}`)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableCard key={item.id} id={`card:${item.id}`}>
              {renderCard(item)}
            </SortableCard>
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function KanbanBoard({ columns, itemsByColumn, renderCard, onMove }) {
  const [board, setBoard] = useState(itemsByColumn);
  const [activeItem, setActiveItem] = useState(null);

  // Re-sync local (optimistic) board state whenever the parent re-fetches
  // fresh data from the server (e.g. after the initial load, or a manual
  // refresh) -- keyed on a lightweight signature so we don't clobber
  // in-progress local drag state on every parent re-render.
  const itemsSignature = Object.values(itemsByColumn)
    .flat()
    .map((i) => i.id)
    .join(',');
  useEffect(() => {
    setBoard(itemsByColumn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSignature]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function findColumnOf(cardId) {
    return Object.keys(board).find((colId) => board[colId].some((i) => `card:${i.id}` === cardId));
  }

  function handleDragStart(event) {
    const cardId = event.active.id;
    const colId = findColumnOf(cardId);
    setActiveItem(board[colId]?.find((i) => `card:${i.id}` === cardId));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const sourceCol = findColumnOf(active.id);
    const targetCol = String(over.id).startsWith('column:')
      ? String(over.id).replace('column:', '')
      : findColumnOf(over.id);
    if (!sourceCol || !targetCol) return;

    setBoard((prev) => {
      const next = { ...prev };
      const sourceItems = [...next[sourceCol]];
      const draggedIndex = sourceItems.findIndex((i) => `card:${i.id}` === active.id);
      const [draggedItem] = sourceItems.splice(draggedIndex, 1);

      if (sourceCol === targetCol) {
        const overIndex = sourceItems.findIndex((i) => `card:${i.id}` === over.id);
        const insertAt = overIndex >= 0 ? overIndex : sourceItems.length;
        sourceItems.splice(insertAt, 0, draggedItem);
        next[sourceCol] = sourceItems;
        onMove(draggedItem.id, targetCol, insertAt);
      } else {
        const targetItems = [...next[targetCol]];
        const overIndex = targetItems.findIndex((i) => `card:${i.id}` === over.id);
        const insertAt = overIndex >= 0 ? overIndex : targetItems.length;
        targetItems.splice(insertAt, 0, draggedItem);
        next[sourceCol] = sourceItems;
        next[targetCol] = targetItems;
        onMove(draggedItem.id, targetCol, insertAt);
      }
      return next;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            items={board[col.id] || []}
            count={(board[col.id] || []).length}
            renderCard={renderCard}
          />
        ))}
      </div>
      <DragOverlay>{activeItem ? <div className="rotate-2">{renderCard(activeItem)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
