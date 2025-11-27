<script lang="ts">
  import StudentForm from '$lib/StudentForm.svelte';
  import StudentCard from '$lib/StudentCard.svelte';
  import StudentModal from '$lib/StudentModal.svelte';

  let view = 'list';
  let estudiantes = [];
  let editingStudent = null;
  let viewingStudent = null;

  function handleSave(event) {
    const data = event.detail;

    if (editingStudent) {
      const index = estudiantes.findIndex(e => e.ci === editingStudent.ci);
      if (index !== -1) estudiantes[index] = data;
    } else {
      if (estudiantes.some(e => e.ci === data.ci)) {
        alert('Error: Ya existe un estudiante con ese Carnet de Identidad.');
        return;
      }
      estudiantes = [...estudiantes, data];
    }

    view = 'list';
    editingStudent = null;
  }

  function handleDelete(event) {
    const ci = event.detail;
    if (confirm('¿Estás seguro de que deseas eliminar este registro permanentemente?')) {
      estudiantes = estudiantes.filter(e => e.ci !== ci);
    }
  }
</script>

<div class="min-h-screen bg-slate-50 font-sans flex flex-col">

  <nav class="bg-slate-900 text-white shadow-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🎓</span>
          <h1 class="text-xl font-bold tracking-tight">Sistema Académico</h1>
        </div>

        <div class="flex space-x-3">
          <button 
            on:click={() => { view='list'; editingStudent=null; }} 
            class="px-4 py-2 rounded-md text-sm font-medium transition 
              {view === 'list' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-700'}">
            Lista de Estudiantes
          </button>

          <button 
            on:click={() => { view='form'; editingStudent=null; }} 
            class="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow transition">
            + Nuevo Registro
          </button>
        </div>
      </div>
    </div>
  </nav>

  <main class="flex-1 max-w-7xl mx-auto w-full p-6">

    {#if view === 'list'}
      <div class="mb-6 flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">Directorio de Estudiantes</h2>
          <p class="text-slate-500 text-sm mt-1">Gestión académica, personal y financiera.</p>
        </div>

        <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-200">
          Total: {estudiantes.length}
        </span>
      </div>

      {#if estudiantes.length === 0}
        <div class="flex flex-col items-center justify-center py-24 bg-white rounded-xl border-2 border-dashed border-slate-300 text-center">
          <div class="text-6xl mb-4 opacity-20">📂</div>
          <p class="text-slate-500 text-lg font-medium">No hay estudiantes registrados.</p>
          <p class="text-slate-400 text-sm mb-6">Comienza agregando uno nuevo al sistema.</p>

          <button on:click={() => view='form'} class="text-indigo-600 font-semibold hover:underline">
            Crear primer estudiante
          </button>
        </div>

      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {#each estudiantes as est}
            <StudentCard
              student={est}
              on:delete={handleDelete}
              on:edit={(e) => { editingStudent = e.detail; view = 'form'; }}
              on:view={(e) => viewingStudent = e.detail}
            />
          {/each}
        </div>
      {/if}

    {:else}
      <StudentForm
        studentData={editingStudent}
        on:save={handleSave}
        on:cancel={() => view='list'}
      />
    {/if}

  </main>

  {#if viewingStudent}
    <StudentModal student={viewingStudent} on:close={() => viewingStudent = null} />
  {/if}

</div>
