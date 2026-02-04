// formateado de fecha a DD/MM/YYYY (01/Feb/2026)
export const formatDate = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '---';

    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    if (isNaN(date.getTime())) return '---';

    // Configuramos el formateador para obtener el nombre corto del mes
    const formatter = new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short', // Esto devuelve "feb" o "feb."
        year: 'numeric'
    });

    const parts = formatter.formatToParts(date);
    
    // Extraemos las partes para armar el formato exacto: DD/Mes/YYYY
    const day = parts.find(p => p.type === 'day')?.value;
    let month = parts.find(p => p.type === 'month')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value;

    // Limpiamos el punto del mes (algunos navegadores ponen "feb.") 
    // y ponemos la primera letra en Mayúscula
    month = month.replace('.', '');
    month = month.charAt(0).toUpperCase() + month.slice(1);

    return `${day}/${month}/${year}`;
};

// formateado de moneda en Bolivianos (Bs.) 
export const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return 'Bs. 0.00';
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'BOB', // Código para Bolivianos
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount).replace('BOB', 'Bs.');
};


