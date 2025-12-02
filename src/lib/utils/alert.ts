import { browser } from '$app/environment';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';

let notyf: Notyf | null = null;

// Only initialize Notyf in the browser environment
if (browser && typeof document !== 'undefined') {
	notyf = new Notyf({
		duration: 2000,
		types: [
			{
				type: 'success',
				className: 'text-white dark:text-dark-one bg-green-500 dark:bg-dark-three',
				icon: `<svg class='size-8' viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /> </svg>`,
				background: ' '
			},
			{
				type: 'error',
				className: 'text-white dark:text-dark-one bg-red-500 dark:bg-dark-three',
				icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-8">
							<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
							</svg>`,
				background: ' '
			},
			{
				type: 'warning',
				className: 'text-black dark:text-dark-one bg-orange-500 dark:bg-dark-three',
				icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-8">
							<path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
							</svg>`,
				background: ' '
			},
			{
				type: 'info',
				className: 'text-black dark:text-dark-one bg-white dark:bg-dark-three',
				icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-8"> <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
		</svg>`,
				background: ' '
			}
		]
	});
}

export function alert(
	type: 'success' | 'error' | 'warning' | 'info',
	text: string,
	position: { x: 'left' | 'center' | 'right'; y: 'top' | 'bottom' } = { x: 'right', y: 'top' }
) {
	// Only try to show notification if we're in browser and notyf is initialized
	if (browser && notyf) {
		notyf.open({ type, message: text, position });
	} else {
		// Fallback for SSR - you can log or handle this however you prefer
		console.log(`[${type.toUpperCase()}]: ${text}`);
	}
}
