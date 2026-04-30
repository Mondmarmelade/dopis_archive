import { atom } from "nanostores";

export const selectedEmailUid = atom(null);
export const currentFolder = atom("inbox");
export const emailsList = atom([]);
