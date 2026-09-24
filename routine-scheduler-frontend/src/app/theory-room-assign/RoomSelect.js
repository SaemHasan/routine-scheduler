import { Form } from "react-bootstrap";

const TYPE_RANK = { 0: 0, 2: 1, 1: 2 };

// Theory rooms first, then rooms for theory and labs, then labs
export const byRoom = (a, b) =>
  (TYPE_RANK[a.type] ?? 3) - (TYPE_RANK[b.type] ?? 3) ||
  Number(/^\(/.test(a.room)) - Number(/^\(/.test(b.room)) ||
  a.room.localeCompare(b.room, undefined, { numeric: true });

/** A room picker: theory rooms first, then rooms for theory and labs, then labs. */
export default function RoomSelect({
  value, rooms, onChange, disabled, placeholder = "No room", size, style, title,
}) {
  const groups = [
    { label: "Theory rooms", list: rooms.filter((r) => r.type === 0) },
    { label: "Theory & lab rooms", list: rooms.filter((r) => r.type === 2) },
    { label: "Lab rooms", list: rooms.filter((r) => r.type === 1) },
  ];
  const known = rooms.some((r) => r.room === value);
  return (
    <Form.Select
      className="form-select"
      size={size}
      style={{ minWidth: size === "sm" ? undefined : "140px", ...style }}
      value={value || ""}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {value && !known && <option value={value}>{value}</option>}
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.list.map((r) => (
              <option key={r.room} value={r.room}>
                {r.room}
              </option>
            ))}
          </optgroup>
        ))}
    </Form.Select>
  );
}
