<script lang="ts">
  import { userStore } from '$lib/stores/userStore';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getRouteByRole } from '$lib/utils/navigation';

  // Subscribe to user store
  let isAuthenticated = false;
  let loginType: 'admin' | 'student' | null = null;
  let user: any = null;

  userStore.subscribe(state => {
    isAuthenticated = state.isAuthenticated;
    loginType = state.loginType;
    user = state.user;
  });

  onMount(() => {
    userStore.init();
    
    if (isAuthenticated && user) {
        const route = getRouteByRole(user.role);
        goto(route);
    } else if (!isAuthenticated && loginType) {
        goto('/auth/sign-in');
    }
  });

  function handleSelectRole(type: 'admin' | 'student') {
    userStore.setLoginType(type);
    goto('/auth/sign-in');
  }
</script>

{#if isAuthenticated}
<div class="min-h-screen bg-slate-50 font-sans flex flex-col">

  <nav class="bg-slate-900 text-white shadow-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🎓</span>
          <h1 class="text-xl font-bold tracking-tight">Sistema Postgrado</h1>
        </div>

        <div class="flex space-x-3">
          <button 
            onclick={() => userStore.logout()} 
            class="px-4 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white shadow transition">
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  </nav>

  <main class="flex-1 max-w-7xl mx-auto w-full p-6">
      <div class="mb-6 flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">Bienvenido, {user?.username || 'Usuario'}</h2>
          <p class="text-slate-500 text-sm mt-1">Has iniciado sesión como {loginType === 'student' ? 'Estudiante' : 'Administrativo'}.</p>
        </div>
      </div>

      <div class="flex flex-col items-center justify-center py-24 bg-white rounded-xl border-2 border-dashed border-slate-300 text-center">
          <div class="text-6xl mb-4 opacity-20">👋</div>
          <p class="text-slate-500 text-lg font-medium">Panel de Control</p>
          <p class="text-slate-400 text-sm mb-6">Próximamente más funcionalidades.</p>
      </div>
  </main>

</div>
{:else}
<!-- Role Selection UI -->
<div class="min-h-screen flex flex-col items-center justify-center bg-light-primary dark:bg-dark-primary p-4">
  <div class="w-full max-w-4xl text-center">
    <div class="mb-12 flex flex-col items-center justify-center">
        <div class="mb-4 flex h-32 w-32 items-center justify-center">
            <img src="/images/logo_empty_datahub.png" alt="" />
        </div>
        <h1 class="text-4xl font-bold text-light-secondary dark:text-dark-secondary mb-2">
            KyC
        </h1>
        <p class="text-light-black/70 dark:text-dark-white/70 text-lg">Selecciona tu tipo de cuenta para continuar</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
        <!-- Student Card -->
        <button 
            onclick={() => handleSelectRole('student')}
            class="group relative flex flex-col items-center p-8 rounded-2xl bg-white dark:bg-dark-surface border-2 border-transparent hover:border-light-tertiary dark:hover:border-dark-tertiary shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
        >
            <div class="h-24 w-24 mb-6 rounded-full bg-light-primary_d dark:bg-dark-primary_d flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span class="text-4xl">🎓</span>
            </div>
            <h2 class="text-2xl font-bold text-light-black dark:text-dark-white mb-2">Estudiante</h2>
            
            <div class="mt-6 px-6 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-tertiary dark:text-dark-tertiary font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Ingresar como Estudiante
            </div>
        </button>

        <!-- Admin Card -->
        <button 
            onclick={() => handleSelectRole('admin')}
            class="group relative flex flex-col items-center p-8 rounded-2xl bg-white dark:bg-dark-surface border-2 border-transparent hover:border-light-secondary dark:hover:border-dark-secondary shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
        >
            <div class="h-24 w-24 mb-6 rounded-full bg-light-primary_d dark:bg-dark-primary_d flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span class="text-4xl">💼</span>
            </div>
            <h2 class="text-2xl font-bold text-light-black dark:text-dark-white mb-2">Administrativo</h2>
            
            <div class="mt-6 px-6 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-secondary dark:text-dark-secondary font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Ingresar como Administrativo
            </div>
        </button>
    </div>
  </div>
</div>
{/if}
