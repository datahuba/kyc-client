import { apiKyC } from '$lib/config';
import type {
	Assignment,
	AssignmentType,
	Classroom,
	ClassroomEnrolledStudent,
	ClassroomMaterial,
	CreateAssignmentRequest,
	CreateClassroomRequest,
	Grade,
	GradeRequest,
	Submission,
	UpdateClassroomRequest
} from '$lib/interfaces';

type WithIds = {
	id?: string;
	_id?: string;
};

function normalizeId<T extends WithIds>(item: T): T {
	if (item._id || !item.id) return item;
	return { ...item, _id: item.id };
}

function normalizeListIds<T extends WithIds>(items: T[]): T[] {
	return items.map(normalizeId);
}

class ClassroomService {
	// ─── CLASSROOM ────────────────────────────────────────────────────────────

	async getMyClasses(): Promise<Classroom[]> {
		const data = await apiKyC.get<(Classroom & { id?: string })[]>('/classroom/my-classes');
		return normalizeListIds(data);
	}

	async getById(classroomId: string): Promise<Classroom> {
		const data = await apiKyC.get<Classroom & { id?: string }>(`/classroom/${classroomId}`);
		return normalizeId(data);
	}

	async create(data: CreateClassroomRequest): Promise<Classroom> {
		const created = await apiKyC.post<Classroom & { id?: string }>('/classroom/', data);
		return normalizeId(created);
	}

	async update(classroomId: string, data: UpdateClassroomRequest): Promise<Classroom> {
		const updated = await apiKyC.put<Classroom & { id?: string }>(`/classroom/${classroomId}`, data);
		return normalizeId(updated);
	}

	async enrollStudent(classroomId: string, studentId: string): Promise<void> {
		await apiKyC.post(`/classroom/${classroomId}/students`, { student_id: studentId });
	}

	async getEnrolledStudents(classroomId: string): Promise<ClassroomEnrolledStudent[]> {
		const data = await apiKyC.get<(ClassroomEnrolledStudent & { id?: string })[]>(`/classroom/${classroomId}/students`);
		return normalizeListIds(data);
	}

	// ─── MATERIALS ────────────────────────────────────────────────────────────

	async getMaterials(classroomId: string): Promise<ClassroomMaterial[]> {
		const data = await apiKyC.get<(ClassroomMaterial & { id?: string })[]>(`/classroom/${classroomId}/materials`);
		return normalizeListIds(data);
	}

	async uploadMaterial(classroomId: string, file: File, title: string): Promise<ClassroomMaterial> {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('title', title);
		const material = await apiKyC.post<ClassroomMaterial & { id?: string }>(`/classroom/${classroomId}/materials`, formData);
		return normalizeId(material);
	}

	async deleteMaterial(classroomId: string, materialId: string): Promise<void> {
		await apiKyC.delete(`/classroom/${classroomId}/materials/${materialId}`);
	}

	// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────

	async getAssignments(classroomId: string, type?: AssignmentType): Promise<Assignment[]> {
		const params = type ? `?type=${type}` : '';
		const data = await apiKyC.get<(Assignment & { id?: string })[]>(`/classroom/${classroomId}/assignments${params}`);
		return normalizeListIds(data);
	}

	async createAssignment(
		classroomId: string,
		data: CreateAssignmentRequest
	): Promise<Assignment> {
		const assignment = await apiKyC.post<Assignment & { id?: string }>(`/classroom/${classroomId}/assignments`, data);
		return normalizeId(assignment);
	}

	async updateAssignment(
		classroomId: string,
		assignmentId: string,
		data: Partial<CreateAssignmentRequest>
	): Promise<Assignment> {
		const assignment = await apiKyC.put<Assignment & { id?: string }>(
			`/classroom/${classroomId}/assignments/${assignmentId}`,
			data
		);
		return normalizeId(assignment);
	}

	async deleteAssignment(classroomId: string, assignmentId: string): Promise<void> {
		await apiKyC.delete(`/classroom/${classroomId}/assignments/${assignmentId}`);
	}

	// ─── SUBMISSIONS ──────────────────────────────────────────────────────────

	async getSubmissions(classroomId: string, assignmentId: string): Promise<Submission[]> {
		const data = await apiKyC.get<(Submission & { id?: string })[]>(
			`/classroom/${classroomId}/assignments/${assignmentId}/submissions`
		);
		return normalizeListIds(data);
	}

	async submit(
		classroomId: string,
		assignmentId: string,
		textContent?: string,
		file?: File
	): Promise<Submission> {
		const formData = new FormData();
		if (textContent) formData.append('text_content', textContent);
		if (file) formData.append('file', file);
		const submission = await apiKyC.post<Submission & { id?: string }>(
			`/classroom/${classroomId}/assignments/${assignmentId}/submit`,
			formData
		);
		return normalizeId(submission);
	}

	async gradeSubmission(
		classroomId: string,
		assignmentId: string,
		submissionId: string,
		data: GradeRequest
	): Promise<Submission> {
		const submission = await apiKyC.put<Submission & { id?: string }>(
			`/classroom/${classroomId}/assignments/${assignmentId}/submissions/${submissionId}/grade`,
			data
		);
		return normalizeId(submission);
	}

	// ─── GRADES ───────────────────────────────────────────────────────────────

	async getGrades(classroomId: string): Promise<Grade[]> {
		return await apiKyC.get<Grade[]>(`/classroom/${classroomId}/grades`);
	}
}

export const classroomService = new ClassroomService();
