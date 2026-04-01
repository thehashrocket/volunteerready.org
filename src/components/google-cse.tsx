'use client';

import Script from 'next/script';

export function GoogleCSE() {
	return (
		<>
			<Script
				src="https://cse.google.com/cse.js?cx=1735cdb8530ef468f"
				strategy="afterInteractive"
			/>
			<div className="gcse-search" />
		</>
	);
}
