import { combineRgb } from '@companion-module/base'

/**
 * Get the available feedbacks.
 *
 * @param {InstanceBase} self
 * @returns {Object} the available feedbacks
 * @access public
 */
export const getFeedbacks = (self) => {
	const feedbacks = {}

	feedbacks['memory_active'] = {
		type: 'boolean',
		name: 'Memory active',
		description: 'If a screen memory is loaded in preset, change the style of the button',
		defaultStyle: {
			color: 0xffffff,
			bgcolor: combineRgb(200, 0, 0),
		},
		options: [
			{
				type: 'number',
				label: 'Screen Memory',
				id: 'memory',
				default: 1,
				min: 1,
				max: 8,
			},
			{
				type: 'dropdown',
				label: 'Screen',
				id: 'screen',
				default: 'any',
				choices: [
					{ id: 'any', label: 'Any' },
					{ id: 0, label: 'S1' },
					{ id: 1, label: 'S2' },
				],
			},
			{
				type: 'dropdown',
				label: 'Program/Preview',
				id: 'preset',
				default: 'pgm',
				choices: [
					{ id: 'pgm', label: 'Program' },
					{ id: 'pvw', label: 'Preview' },
					{ id: 'any', label: 'Any' },
				],
			},
		],
		callback: (feedback) => {
			if (feedback.options.screen === 'any') {
				if (
					(feedback.options.preset === 'pgm' || feedback.options.preset === 'any') &&
					self.memoriesPGM.some((mem) => mem === feedback.options.memory - 1)
				) {
					return true
				}
				if (
					(feedback.options.preset === 'pvw' || feedback.options.preset === 'any') &&
					self.memoriesPVW.some((mem) => mem === feedback.options.memory - 1)
				) {
					return true
				}
			} else {
				if (
					(feedback.options.preset === 'pgm' || feedback.options.preset === 'any') &&
					self.memoriesPGM[feedback.options.screen] === feedback.options.memory - 1
				) {
					return true
				}
				if (
					(feedback.options.preset === 'pvw' || feedback.options.preset === 'any') &&
					self.memoriesPVW[feedback.options.screen] === feedback.options.memory - 1
				) {
					return true
				}
			}
			return false
		},
	}

	return feedbacks
}
