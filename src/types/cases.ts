export interface Choice {
	text: string;
	label: string;
}

export interface CaseData {
	question: string;
	choices: Choice[];
	answerKey: string;
	// For the actual data structure
	task?: string;
	options?: string[];
	correctAnswer?: string;
}
