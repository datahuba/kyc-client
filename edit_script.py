with open('src/routes/app/enrollments/+page.svelte', 'r', encoding='utf-8') as f:
    content = f.read()

# Edit 1: Import UsersIcon and StudentForm
content = content.replace(
    "import { PlusIcon, DotsVerticalIcon } from '$lib/icons/outline';",
    "import StudentForm from '$lib/features/students/StudentForm.svelte';\n\timport { PlusIcon, DotsVerticalIcon, UsersIcon } from '$lib/icons/outline';"
)

# Edit 2: Variables
content = content.replace(
    "let isFormOpen: boolean = $state(false);",
    "let isFormOpen: boolean = $state(false);\n\tlet isStudentFormOpen: boolean = $state(false);"
)

# Edit 3: Button
old_btn = '''\t\t{#if canCreateEnrollment}
\t\t\t<Button onclick={handleCreate}>
\t\t\t\t{#snippet leftIcon()}
\t\t\t\t\t<PlusIcon class="size-5" />
\t\t\t\t{/snippet}
\t\t\t\tNueva Inscripción
\t\t\t</Button>
\t\t{/if}'''
new_btn = '''\t\t{#if canCreateEnrollment}
\t\t\t<div class="flex gap-2">
\t\t\t\t<Button onclick={() => isStudentFormOpen = true} variant="outline">
\t\t\t\t\t{#snippet leftIcon()}
\t\t\t\t\t\t<UsersIcon class="size-5" />
\t\t\t\t\t{/snippet}
\t\t\t\t\tNuevo Estudiante
\t\t\t\t</Button>
\t\t\t\t<Button onclick={handleCreate}>
\t\t\t\t\t{#snippet leftIcon()}
\t\t\t\t\t\t<PlusIcon class="size-5" />
\t\t\t\t\t{/snippet}
\t\t\t\t\tNueva Inscripción
\t\t\t\t</Button>
\t\t\t</div>
\t\t{/if}'''
content = content.replace(old_btn, new_btn)

# Edit 4: Component at bottom
old_bottom = '''\t\t</div>
\t</Modal>
</div>
'''
new_bottom = '''\t\t</div>
\t</Modal>

\t<!-- Nuevo Estudiante Modal -->
\t<StudentForm
\t\tisOpen={isStudentFormOpen}
\t\tstudent={null}
\t\tonClose={() => { isStudentFormOpen = false; }}
\t\tonSuccess={() => {
\t\t\tisStudentFormOpen = false;
\t\t\tloadData();
\t\t}}
\t/>
</div>
'''
content = content.replace(old_bottom, new_bottom)

with open('src/routes/app/enrollments/+page.svelte', 'w', encoding='utf-8') as f:
    f.write(content)
