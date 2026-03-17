<script lang="ts">
  import { userStore } from '$lib/stores/userStore';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getRouteByRole } from '$lib/utils/navigation';

  // Subscribe to user store
  let isAuthenticated = false;
  let loginType: 'admin' | 'academic' | null = null;
  let academicRole: 'teacher' | 'student' | null = null;
  let user: any = null;

  userStore.subscribe(state => {
    isAuthenticated = state.isAuthenticated;
    loginType = state.loginType;
    academicRole = state.academicRole;
    user = state.user;
  });

  onMount(() => {
    userStore.init();
    
    if (isAuthenticated && user) {
        const route = getRouteByRole(user.role, loginType, academicRole);
        goto(route);
    } else if (!isAuthenticated && loginType) {
        goto('/auth/sign-in');
    }
  });

  function handleSelectRole(type: 'admin' | 'academic') {
    if (type === 'academic') {
      goto('/auth/academic-selection');
    } else {
      userStore.setLoginType(type);
      goto('/auth/sign-in');
    }
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
          <p class="text-slate-500 text-sm mt-1">
            Has iniciado sesión como {loginType === 'academic' ? (academicRole === 'teacher' ? 'Docente' : 'Estudiante') : 'Administrativo'}.
          </p>
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

    <div class="flex flex-wrap gap-4 justify-center max-w-3xl mx-auto px-4">

    <button 
        onclick={() => handleSelectRole('academic')}
        class="group relative overflow-hidden px-8 py-4 rounded-lg bg-light-primary dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-light-secondary dark:hover:border-light-secondary transition-all duration-300 hover:shadow-lg hover:shadow-light-four hover:-translate-y-1"
    >

        <div class="absolute inset-0 bg-gradient-to-r from-light-primary_d to-light-tertiary translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
        

        <div class="relative z-10 flex items-center gap-3">
            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-white transition-colors duration-300 group-hover:scale-110 group-hover:rotate-12 transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M12 6.253v13m0-13C6.5 6.253 3 9.585 3 13.667c0 5.202 9 11.053 9 11.053s9-5.851 9-11.053c0-4.082-3.5-7.414-9-7.414z" />
            </svg>
            
            <span class="text-lg font-semibold text-gray-800 dark:text-gray-200 group-hover:text-white transition-colors duration-300">
                Académico
            </span>
        </div>
    </button>


    <button 
        onclick={() => handleSelectRole('admin')}
        class="group relative overflow-hidden px-8 py-4 rounded-lg bg-light-primary dark:bg-dark-primary border-2 border-gray-200 dark:border-gray-700 hover:border-light-secondary dark:hover:border-light-secondary transition-all duration-300 hover:shadow-lg hover:shadow-light-four hover:-translate-y-1"
    >
      
        <div class="absolute inset-0 bg-gradient-to-r from-light-tertiary to-light-primary translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
        
    
        <div class="relative z-10 flex items-center gap-3">
            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-white transition-colors duration-300 group-hover:scale-110 group-hover:-rotate-12 transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
            </svg>
            
            <span class="text-lg font-semibold text-gray-800 dark:text-gray-200 group-hover:text-white transition-colors duration-300">
                Administrativo
            </span>
        </div>
    </button>
</div>
  </div>
</div>
{/if}
<style>
    button {
        -webkit-tap-highlight-color: transparent;
    }
</style>