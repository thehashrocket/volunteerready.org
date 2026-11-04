// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { WalkthroughVideo } from './walkthrough-video';

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => analytics);

const PROPS = {
	src: '/marketing/walkthrough.mp4',
	poster: '/marketing/walkthrough-poster.jpg',
	durationLabel: '1-minute',
	transcript: ['First line.', 'Second line.'],
} as const;

beforeAll(() => {
	// jsdom has no media playback.
	window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
});

describe('WalkthroughVideo', () => {
	it('shows only the poster and a play button until clicked', () => {
		const { container } = render(<WalkthroughVideo {...PROPS} />);

		expect(
			screen.getByRole('button', {
				name: 'Play the 1-minute VolunteerReady walkthrough',
			}),
		).toBeTruthy();
		// The video must not be mounted before play: keeps the file off the
		// page-load critical path.
		expect(container.querySelector('video')).toBeNull();
	});

	it('mounts the video with controls and starts it on click', () => {
		const { container } = render(<WalkthroughVideo {...PROPS} />);

		fireEvent.click(screen.getByRole('button', { name: /Play the 1-minute/ }));

		const video = container.querySelector('video');
		expect(video).not.toBeNull();
		expect(video?.getAttribute('src')).toBe(PROPS.src);
		expect(video?.hasAttribute('controls')).toBe(true);
		expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
		expect(
			screen.queryByRole('button', { name: /Play the 1-minute/ }),
		).toBeNull();
	});

	it('renders the caption, then the captions as a text transcript', () => {
		render(<WalkthroughVideo {...PROPS} caption="Sample data." />);

		expect(screen.getByText('Sample data.')).toBeTruthy();

		expect(screen.getByText('Read the transcript')).toBeTruthy();
		expect(screen.getByText('First line.')).toBeTruthy();
		expect(screen.getByText('Second line.')).toBeTruthy();
	});

	it('records a walkthrough_play event when played', () => {
		analytics.trackEvent.mockClear();
		render(<WalkthroughVideo {...PROPS} />);

		fireEvent.click(screen.getByRole('button', { name: /Play the 1-minute/ }));

		expect(analytics.trackEvent).toHaveBeenCalledWith('walkthrough_play', {
			page_path: window.location.pathname,
		});
	});
});
