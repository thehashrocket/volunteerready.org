import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(ts|tsx)'],
	addons: ['@storybook/addon-themes'],
	framework: {
		name: '@storybook/react-vite',
		options: {},
	},
	viteFinal: async (config) => {
		const path = await import('node:path');
		config.resolve = config.resolve || {};
		config.resolve.alias = {
			...config.resolve.alias,
			'@': path.resolve(import.meta.dirname, '../src'),
		};
		return config;
	},
};

export default config;
