'use client';

import { useState } from 'react';

export default function SubmitPrompt() {
	const [prompt, setPrompt] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [result, setResult] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			const response = await fetch('/api/evaluate-prompt', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ prompt }),
			});

			const data = await response.json();
			setResult(data.result);
		} catch (error) {
			console.error('Error submitting prompt:', error);
			setResult('An error occurred while evaluating your prompt.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto">
				<div className="text-center">
					<h1 className="text-3xl font-bold text-gray-900 mb-8">Submit Your Prompt</h1>
					<p className="text-lg text-gray-600 mb-8">
						Enter your prompt below to evaluate its effectiveness and get feedback.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label
							htmlFor="prompt"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Your Prompt
						</label>
						<textarea
							id="prompt"
							name="prompt"
							rows={6}
							className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Enter your prompt here..."
							required
						/>
					</div>

					<div>
						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
						>
							{isSubmitting ? 'Evaluating...' : 'Submit Prompt'}
						</button>
					</div>
				</form>

				{result && (
					<div className="mt-8 p-4 bg-white rounded-lg shadow">
						<h2 className="text-lg font-medium text-gray-900 mb-2">
							Evaluation Result
						</h2>
						<p className="text-gray-600 whitespace-pre-wrap">{result}</p>
					</div>
				)}
			</div>
		</div>
	);
}
