'use client';

import { useState, useEffect } from 'react';
import { CaseData } from '@/types/cases';
import Link from 'next/link';

export default function CasesPage() {
	const [cases, setCases] = useState<CaseData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

	useEffect(() => {
		async function fetchCases() {
			try {
				const response = await fetch('/api/cases');
				if (!response.ok) {
					throw new Error('Failed to fetch cases');
				}
				const data = await response.json();

				// Transform the data to match our component's expected structure
				const transformedData = (data.data || []).map((item: any) => ({
					question: item.task || '',
					choices: (item.options || []).map((option: string, index: number) => ({
						text: option,
						label: option,
					})),
					answerKey: item.correctAnswer || '',
				}));

				setCases(transformedData);
				setLoading(false);
			} catch (err) {
				setError('Error loading cases. Please try again later.');
				setLoading(false);
				console.error(err);
			}
		}

		fetchCases();
	}, []);

	const copyToClipboard = async () => {
		try {
			setCopyStatus('copying');
			const response = await fetch('/api/download');
			const jsonData = await response.text();
			await navigator.clipboard.writeText(jsonData);
			setCopyStatus('copied');
			
			// Reset status after 2 seconds
			setTimeout(() => {
				setCopyStatus('idle');
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
			setCopyStatus('idle');
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen p-8">
				<h1 className="text-2xl font-bold mb-6">Cases</h1>
				<div className="flex justify-center items-center h-64">
					<p>Loading cases...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen p-8">
				<h1 className="text-2xl font-bold mb-6">Cases</h1>
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
					{error}
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen p-8">
			<div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
				<h1 className="text-2xl font-bold">Commonsense QA Cases</h1>
				<div className="flex gap-2">
					<button
						onClick={copyToClipboard}
						disabled={copyStatus === 'copying'}
						className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center disabled:opacity-50"
					>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
						</svg>
						{copyStatus === 'copying' ? 'Copying...' : copyStatus === 'copied' ? 'Copied!' : 'Copy to Clipboard'}
					</button>
					<a 
						href="/api/download" 
						download="commonsense_qa_openai_gpt-4o-mini.json"
						className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center"
					>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						Download JSON
					</a>
				</div>
			</div>

			<div className="grid gap-6">
				{cases.map((caseItem, index) => (
					<div key={index} className="bg-white p-6 rounded-lg shadow-md">
						<h2 className="text-xl font-semibold mb-3">{caseItem.question}</h2>

						<div className="mt-3">
							<p className="font-medium text-gray-700">Options:</p>
							<ul className="list-disc list-inside ml-4 mt-2">
								{caseItem.choices.map((choice, choiceIndex) => (
									<li
										key={choiceIndex}
										className={
											choice.text === caseItem.answerKey
												? 'text-green-600 font-medium'
												: ''
										}
									>
										{choice.text}{' '}
										{choice.text === caseItem.answerKey && '(Correct Answer)'}
									</li>
								))}
							</ul>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
