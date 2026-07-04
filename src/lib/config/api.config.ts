const getEnvVariable = (key: string): string => {
	const value = import.meta.env[key];
	if (!value) {
		throw new Error(`La variable de entorno ${key} no está definida`);
	}
	return value;
};

const API_BASE_URL = getEnvVariable('VITE_API_BASE_URL');

export const defaultHeaders: HeadersInit = {
	'Content-Type': 'application/json'
};

export const API_CONFIG = {
	BASE_URL: API_BASE_URL,
	TIMEOUT: 30000,
	MAX_RETRIES: 3
} as const;
