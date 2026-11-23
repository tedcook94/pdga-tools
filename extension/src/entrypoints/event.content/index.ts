import { parseEventPage } from '@/lib/event-page';
import { importedEventId } from '@/lib/import';
import { importFromPage } from '@/lib/page-import';
import { addRowButtons } from '@/lib/row-buttons';
import { eventStore, pdgaEventIdFromPath, savedPlayers } from '@/lib/storage';

export default defineContentScript({
	matches: ['https://www.pdga.com/tour/event/*'],

	async main(ctx) {
		const pdgaEventId = pdgaEventIdFromPath(location.pathname);
		// Upcoming events have no results table yet.
		if (!pdgaEventId || !parseEventPage(document)) return;

		const imported = new Set<string>();
		await Promise.all(
			(await savedPlayers()).map(async (player) => {
				const { events } = await eventStore(player).load();
				const id = importedEventId(player, pdgaEventId);
				if (events.some((event) => event.id === id)) imported.add(player);
			})
		);

		const remove = addRowButtons(document, imported, (player) =>
			importFromPage(document, pdgaEventId, player)
		);
		ctx.onInvalidated(remove);
	}
});
