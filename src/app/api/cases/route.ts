import { NextResponse } from 'next/server';
import cases from '@/processed/commonsense_qa_openai_gpt-4o-mini.json';

export async function GET() {
	try {
		// Process your data here
		// For example, create a new case in your database

		return NextResponse.json(
			{ message: 'Case created successfully', data: cases },
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating case:', error);
		return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
	}
}
