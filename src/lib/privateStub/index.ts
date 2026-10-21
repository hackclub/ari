import type { PrivateProvider } from '$lib/privateApi';

export const privateProvider: PrivateProvider = {
	enabled: false,
	slots: { reviewTiles: {}, settingsCards: [], wizardSteps: [] },
	shipWarnings: async () => [],
	onShipOpened: async () => [],
	beforeDecision: async () => ({ blocked: false }),
	excludedMakers: async () => [],
	routeHeldDecision: async () => 'secondPass',
	afterDecision: async () => {},
	dismissWarning: async () => false,
	reviewPanelData: async () => ({}),
	programNavTabs: async () => [],
	fraudPage: async () => null,
	describeAutoReason: () => null,
	describeActivity: () => null,
	describeCaptureNote: () => null,
	projectLink: () => null,
	reviewEndpoint: async () => null,
	appOverlayData: async () => null,
	appEndpoint: async () => null,
	settingsLoad: async () => ({}),
	settingsSave: async () => ({
		changed: [],
		diff: {},
		programData: {},
		writes: async () => {},
		afterCommit: async () => {}
	}),
	mcpTools: () => [],
	programCreated: async () => []
};
