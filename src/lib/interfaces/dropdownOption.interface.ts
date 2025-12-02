export interface DropdownOption {
	id: string;
	icon?: string;
	label: string;
	action?: () => void;
	divider?: boolean;
	disabled?: boolean;
}
