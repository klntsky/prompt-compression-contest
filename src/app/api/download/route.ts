import cases from '@/data/processed/commonsense_qa_openai_gpt-4o-mini.json';
import { NextResponse } from 'next/server';

export async function GET() {
	try {
		// Create appropriate headers for file download
		const headers = new Headers();
		headers.set(
			'Content-Disposition',
			'attachment; filename="commonsense_qa_openai_gpt-4o-mini.json"'
		);
		headers.set('Content-Type', 'application/json');

		// Return the file as a downloadable response
		return new NextResponse(JSON.stringify(cases), {
			status: 200,
			headers,
		});
	} catch (error) {
		console.error('Error serving JSON file:', error);
		return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
	}
}
