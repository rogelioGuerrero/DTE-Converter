// Para depuración - abre la consola del navegador y ejecuta:
console.log('PIN desde env:', import.meta.env.VITE_ADMIN_PIN);
console.log('hasAdminPin():', (await import('./utils/adminPin')).hasAdminPin());
