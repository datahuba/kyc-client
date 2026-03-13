// Tipos de actividad evaluable
export type AssignmentType = 'TASK' | 'EXAM';

// Estado de entrega del estudiante
export type SubmissionStatus = 'pending' | 'submitted' | 'graded';

export interface Classroom {
	_id: string;
	nombre: string;
	descripcion?: string;
	course_id?: string;
	course_nombre?: string;
	teacher_user_id?: string;
	teacher_name?: string;
	activo: boolean;
	created_at?: string;
}

export interface CreateClassroomRequest {
	nombre: string;
	descripcion?: string;
	course_id?: string;
}

export interface UpdateClassroomRequest {
	nombre?: string;
	descripcion?: string;
	activo?: boolean;
}

export interface ClassroomEnrolledStudent {
	_id: string;
	registro: string;
	nombre?: string;
	email?: string;
	activo: boolean;
}

export interface ClassroomMaterial {
	_id: string;
	classroom_id: string;
	title: string;
	file_url: string;
	public_id?: string;
	resource_type?: string;
	mime_type?: string;
	size_bytes?: number;
	uploaded_by?: string;
	created_at?: string;
	active: boolean;
}

export interface Assignment {
	_id: string;
	classroom_id: string;
	title: string;
	description?: string;
	type: AssignmentType;
	due_at?: string;
	max_score: number;
	created_by?: string;
	created_at?: string;
}

export interface CreateAssignmentRequest {
	title: string;
	description?: string;
	type: AssignmentType;
	due_at?: string;
	max_score?: number;
}

export interface Submission {
	_id: string;
	assignment_id: string;
	classroom_id: string;
	student_id: string;
	text_content?: string;
	file_url?: string;
	mime_type?: string;
	size_bytes?: number;
	status: SubmissionStatus;
	score?: number;
	max_score?: number;
	feedback?: string;
	submitted_at?: string;
	graded_at?: string;
}

export interface Grade {
	assignment_id: string;
	assignment_title: string;
	assignment_type: AssignmentType;
	due_at?: string;
	status: SubmissionStatus;
	score?: number;
	max_score: number;
	feedback?: string;
	submitted_at?: string;
	graded_at?: string;
}

export interface GradeRequest {
	score: number;
	feedback?: string;
}
