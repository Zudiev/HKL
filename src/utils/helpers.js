import { SCALE } from "../questions/questions.js";

export const MAX_VAL = Math.max(...SCALE.map((s) => s.value));
export const labelOf = (val) => SCALE.find((s) => s.value === val)?.label ?? "-";
export const pctOf   = (val) => Math.round((val / MAX_VAL) * 100);
