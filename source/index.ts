import { Client, CommandInteraction, Intents, MessageActionRow, MessageButton } from "discord.js"
import pInterval from "interval-promise"
import Tetris from "./tetris.js"

const squareMap = new Map([
	["red", "🟥"],
	["blue", "🟦"],
	["cyan", "🟦"],
	["orange", "🟧"],
	["yellow", "🟨"],
	["green", "🟩"],
	["magenta", "🟪"],
	["black", "⬛"],
	["white", "⬜"],
])

const bot = new Client({ intents: [Intents.FLAGS.GUILDS] })

const gameInstanceMap = new Map<string, [Tetris, CommandInteraction]>()

const controls = new MessageActionRow()
	.addComponents(
		new MessageButton()
			.setCustomId("moveLeft")
			.setLabel("←")
			.setStyle("PRIMARY"),
		new MessageButton()
			.setCustomId("rotate")
			.setLabel("↻")
			.setStyle("PRIMARY"),
		new MessageButton()
			.setCustomId("hardDrop")
			.setLabel("↓")
			.setStyle("PRIMARY"),
		new MessageButton()
			.setCustomId("moveRight")
			.setLabel("→")
			.setStyle("PRIMARY"),
	)

const formatPlayfield = (playfield: string[][]) => playfield.map(row => row.map(colour => squareMap.get(colour || "black")).join("")).join("\n")

bot.on("interactionCreate", async interaction => {
	if (interaction.isButton()) {
		if (!gameInstanceMap.has(interaction.user.id)) {
			return
		}
		
		const [game, commandInteraction] = gameInstanceMap.get(interaction.user.id)

		if (interaction.customId === "moveLeft") {
			game.moveLeft()
		}

		if (interaction.customId === "rotate") {
			game.rotate()
		}

		if (interaction.customId === "hardDrop") {
			game.hardDrop()
		}

		if (interaction.customId === "moveRight") {
			game.moveRight()
		}

		await Promise.all([
			interaction.deferUpdate(),
			commandInteraction.editReply(formatPlayfield(game.playfield)),
		])
	}

	if (interaction.isCommand() && interaction.commandName === "tetris") {
		if (gameInstanceMap.has(interaction.user.id)) {
			const [game] = gameInstanceMap.get(interaction.user.id)
			await pInterval(async (_, stop) => {
				await interaction.editReply(formatPlayfield(game.playfield))

				if (game.isGameOver) {
					stop()
					await interaction.editReply(`You loose! Score: ${game.linesCleared}`)
				}
			}, 1000)
		}

		const game = new Tetris(19, 10)
		await interaction.deferReply({ ephemeral: true })
		await interaction.editReply({
			content: formatPlayfield(game.playfield),
			components: [controls],
		})

		gameInstanceMap.set(interaction.user.id, [game, interaction])

		await pInterval(async (_, stop) => {
			game.drop()

			await interaction.editReply(formatPlayfield(game.playfield))

			if (game.isGameOver) {
				stop()
				await interaction.editReply(`You loose! Score: ${game.linesCleared}`)
				gameInstanceMap.delete(interaction.user.id)
			}
		}, 1000)
	}
})

await bot.login(process.env.DISCORD_BOT_TOKEN)

console.log("Ready!")
