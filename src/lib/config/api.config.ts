const getEnvVariable = (key: string): string => {
	const value = import.meta.env[key];
	if (!value) {
		throw new Error(`La variable de entorno ${key} no está definida`);
	}
	return value;
};

/**
 * ISSUE-DEV-APIURL: normaliza la URL base para evitar el duplicado `/api/api/v1`.
 *
 * El cliente (`apiKyC.config.ts`) siempre agrega el sufijo `/api/v1` a cada
 * petición. Si `VITE_API_BASE_URL` viene configurada con un `/api` final
 * (ej. `https://datahuba.com/api`, como quedó en producción), el resultado
 * final duplicaba el segmento: `https://datahuba.com/api/api/v1/...`.
 *
 * Esta función deja la base siempre "limpia" (sin `/api` ni `/` finales),
 * sin importar si la variable de entorno se configuró con o sin ese sufijo.
 */
const normalizeApiBaseUrl = (rawUrl: string): string => {
	return rawUrl.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
};

const API_BASE_URL = normalizeApiBaseUrl(getEnvVariable('VITE_API_BASE_URL'));

export const defaultHeaders: HeadersInit = {
	'Content-Type': 'application/json'
};

export const API_CONFIG = {
	BASE_URL: API_BASE_URL,
	TIMEOUT: 30000,
	MAX_RETRIES: 3
} as const;
