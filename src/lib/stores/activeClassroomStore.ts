import { writable } from 'svelte/store';

interface ActiveClassroom {
	id: string | null;
	nombre: string | null;
}

export const activeClassroomStore = writable<ActiveClassroom>({ id: null, nombre: null });
