const { InstanceBase, Regex, runEntrypoint, InstanceStatus, TCPHelper } = require('@companion-module/base')

class MidraInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	init(config) {
		let self = this

		self.config = config

		this.firmwareVersion = "0"
		this.numOutputs = 0
		this.numInputs = 0
		this.modelnum
		this.modelname = ''

		self.init_actions() // export actions
		self.init_tcp()
	}

	init_tcp() {
		let self = this
		let receivebuffer = ''
		self.updateStatus(InstanceStatus.Connecting)

		if (self.socket !== undefined) {
			self.socket.destroy()
		}

		if (self.config.host) {
			self.socket = new TCPHelper(self.config.host, 10500)

			self.socket.on('status_change', (status, message) => {
				self.updateStatus(status, message)
			})

			self.socket.on('error', (err) => {
				self.log('debug', "Network error "+ err)
				self.log('error',"Network error: " + err.message)
			})

			self.socket.on('connect', () => {
				self.log('debug', "Connected")
				self.updateStatus(InstanceStatus.Ok)
				self.sendcmd("*")
			})

			// separate buffered stream into lines with responses
			self.socket.on('data', (chunk) => {
				let i = 0, line = '', offset = 0
				receivebuffer += chunk
				while ( (i = receivebuffer.indexOf('\r\n', offset)) !== -1) {
					line = receivebuffer.substring(offset, i - offset)
					offset = i + 1
					self.socket.emit('receiveline', line.toString())
				}
				receivebuffer = receivebuffer.substring(offset)
			})

			self.socket.on('receiveline', (line) => {
				self.log('debug', "Received line from Midra: " + line)

				if (line.match(/\*1/)) {
					self.log('info',"Ethernet connection to "+ self.config.label +" established. Device ready.")
					self.sendcmd("?")
				}
				if (line.match(/DEV\d+/)) {
					this.model = parseInt(line.match(/DEV(\d+)/)[1])
					switch (this.model) {
						case 257: this.modelname = 'Eikos2'; break
						case 258: this.modelname = 'Saphyr'; break
						case 259: this.modelname = 'Pulse2'; break
						case 260: this.modelname = 'SmartMatriX2'; break
						case 261: this.modelname = 'QuickMatriX'; break
						case 262: this.modelname = 'QuickVu'; break
						case 282: this.modelname = 'Saphyr - H'; break
						case 283: this.modelname = 'Pulse2 - H'; break
						case 284: this.modelname = 'SmartMatriX2 - H'; break
						case 285: this.modelname = 'QuickMatriX - H'; break
						default: this.modelname = 'unknown'; break
					}
					self.log('info', self.config.label +" Type is "+ this.modelname)
					self.sendcmd("VEvar")
				}

				if (line.match(/VEvar\d+/)) {
					let commandSetVersion = parseInt(line.match(/VEvar(\d+)/)[1])
					self.log('info', "Command set version of " + self.config.label +" is " + commandSetVersion)
				}

				if (line.match(/#0/)) {
					//There is no parameter readback runnning, it can be started now
				}


				if (line.match(/E\d{2}/)) {
					switch (parseInt(line.match(/E(\d{2})/)[1])) {
						case 10: self.log('error',"Received command name error from "+ self.config.label +": "+ line); break
						case 11: self.log('error',"Received index value out of range error from "+ self.config.label +": "+ line); break
						case 12: self.log('error',"Received index count (too few or too much) error from "+ self.config.label +": "+ line); break
						case 13: self.log('error',"Received value out of range error from "+ self.config.label +": "+ line); break
						default: self.log('error',"Received unspecified error from Midra "+ self.config.label +": "+ line)
					}
				}

			})

		}
	}

	configUpdated(config) {
		const self = this
		if (
			(config.host && config.host !== self.config.host) ||
			(config.variant && config.variant !== self.config.variant)
		) {
			self.log('debug', 'Config updated, destroying and reiniting..')
			self.config = config
			self.destroy()
			self.init(self.config)
		}
	}

	// Return config fields for web config
	getConfigFields() {
		let self = this

		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'IP-Adress of Midra Unit',
				width: 6,
				default: '192.168.2.140',
				regex: Regex.IP,
				tooltip: 'Enter the IP-adress of the Midra unit you want to control. The IP of the unit can be found on the frontpanel LCD.'
			},{
				type: 'dropdown',
				label: 'Variant',
				id: 'variant',
				default: '259',
				choices: [
					{id:'257' , label:"Eikos2"},
					{id:'258' , label:"Saphyr"},
					{id:'282' , label:"Saphyr - H"},
					{id:'259' , label:"Pulse2"},
					{id:'283' , label:"Pulse2 - H"},
					{id:'260' , label:"SmartMatriX2"},
					{id:'284' , label:"SmartMatriX2 - H"},
					{id:'261' , label:"QuickMatriX"},
					{id:'285' , label:"QuickMatriX - H"},
					{id:'262' , label:"QuickVu"}
				]
			}
		]
	}

	// When module gets deleted
	destroy() {
		let self = this

		if (self.socket !== undefined) {
			self.socket.destroy()
		}

		self.log('debug', "destroy " + self.id);
	}

	init_actions() {
		let self = this

		const actionCallback = (action) => {
			let self = this
			let cmd = ''
	
			if (action.options) {
				for (let i = 0; i<= 5; i++) {
					if (action.options.hasOwnProperty(i) && action.options[i] != '') {
						cmd += action.options[i] + ','
					}
				}
				if (action.options.hasOwnProperty('value') && action.options['value'] != '') {
					cmd += action.options['value']
				}
			}
			cmd += action.actionId
	
			self.sendcmd(cmd)
		}
	
		self.setActionDefinitions({
					/*
						Note: For self generating commands use option ids 0,1,...,5 and 'value'.
						The command will be of the form [valueof0],[valueof1],...[valueof5],[valueofvalue][CommandID]
						for set-commands you need a value, for get-commands you mustn't have a value
						for simple commands the value can be hardcoded in the CommandID, like "1SPtsl".
					*/
			'1GCtal': {
				name: 'Take all',
				options: [],
				callback: actionCallback
			},
			'takescreen': {
				name: 'Take single screen',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				}],
				callback: (action) => {
					const cmd = '' + action.options.screen + ',1GCtak'
					self.sendcmd(cmd)
				}
			},
			'loadpreset': {
				name: 'Load Memory',
				options: [{
					type: 'textinput',
					label: 'Memory to load',
					id: 'memory',
					default: '1',
					tooltip: 'Enter the number of the memory you want to load from 1 to 8',
					regex: '/^0*[1-8]$/'
				},{
					type: 'dropdown',
					label: 'Screen to load to',
					id: 'destscreen',
					default: '0',
					tooltip: 'Select the screen where you want the memory to be recalled to.',
					choices: [ { id: '0', label: 'S1' }, { id: '1', label: 'S2' }]
				},{
					type: 'dropdown',
					label: 'PGM/PVW',
					id: 'pvwpgm',
					default: '1',
					tooltip: 'Select wether the memory schould be loaded into the preview or program of the screen',
					choices: [ { id: '0', label: 'Program' }, { id: '1', label: 'Preview' }]
				},{
					type: 'dropdown',
					label: 'Screen to load from',
					id: 'sourcescreen',
					default: '0',
					tooltip: 'Select the screen where the memory to be recalled has been saved.',
					choices: [ { id: '0', label: 'S1' }, { id: '1', label: 'S2' }]
				},{
					type: 'dropdown',
					label: 'Scale enable',
					id: 'filter1',
					default: '0',
					tooltip: 'Select wether the layers in the memory should be scaled according to the size of the screen if it is different from the size of the screens which the memory has been saved from.',
					choices: [ { id: '0', label: 'Enable scale' }, { id: '1', label: 'Do not scale' }]
				},{
					type: 'dropdown',
					label: 'Filter Source',
					id: 'filter2',
					default: '0',
					tooltip: 'Select wether the layer source should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Source' }, { id: '1', label: 'Exclude Source' }]
				},{
					type: 'dropdown',
					label: 'Filter Position and Size',
					id: 'filter4',
					default: '0',
					tooltip: 'Select wether the layer position and size should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Pos/Size' }, { id: '1', label: 'Exclude Pos/Size' }]
				},{
					type: 'dropdown',
					label: 'Filter Trancparency',
					id: 'filter8',
					default: '0',
					tooltip: 'Select wether the layer transparency should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Transparency' }, { id: '1', label: 'Exclude Transparency' }]
				},{
					type: 'dropdown',
					label: 'Filter Cropping',
					id: 'filter16',
					default: '0',
					tooltip: 'Select wether the layer cropping should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Cropping' }, { id: '1', label: 'Exclude Cropping' }]
				},{
					type: 'dropdown',
					label: 'Filter Border',
					id: 'filter32',
					default: '0',
					tooltip: 'Select wether the layer border should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Border' }, { id: '1', label: 'Exclude Border' }]
				},{
					type: 'dropdown',
					label: 'Filter Transition',
					id: 'filter64',
					default: '0',
					tooltip: 'Select wether the layer transition should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Transition' }, { id: '1', label: 'Exclude Transition' }]
				},{
					type: 'dropdown',
					label: 'Filter Timing',
					id: 'filter128',
					default: '0',
					tooltip: 'Select wether the layer timing should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Timing' }, { id: '1', label: 'Exclude Timing' }]
				},{
					type: 'dropdown',
					label: 'Filter Effects',
					id: 'filter256',
					default: '0',
					tooltip: 'Select wether the layer effects should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Effects' }, { id: '1', label: 'Exclude Effects' }]
				},{
					type: 'dropdown',
					label: 'Filter Audio',
					id: 'filter512',
					default: '0',
					tooltip: 'Select wether the audio layer should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Audio' }, { id: '1', label: 'Exclude Audio' }]
				}],
				callback: (action) => {
					let cmd = ''
					if (action.options.sourcescreen == '0') {
						cmd = '0,'
					} else {
						cmd = '1,'
					}
		
					cmd += '' + (parseInt(action.options.memory)-1) + ','
		
					if (action.options.destscreen == '0') {
						cmd += '0,'
					} else {
						cmd += '1,'
					}
		
					if (action.options.pvwpgm == '0') {
						cmd += '0,'
					} else {
						cmd += '1,'
					}
		
					let filterval = 0
					if (action.options.filter1 == '1') filterval += 1
					if (action.options.filter2 == '1') filterval += 2
					if (action.options.filter4 == '1') filterval += 4
					if (action.options.filter8 == '1') filterval += 8
					if (action.options.filter16 == '1') filterval += 16
					if (action.options.filter32 == '1') filterval += 32
					if (action.options.filter64 == '1') filterval += 64
					if (action.options.filter128 == '1') filterval += 128
					if (action.options.filter256 == '1') filterval += 256
					if (action.options.filter512 == '1') filterval += 512
		
					cmd += filterval + ',1GClrq'

					self.sendcmd(cmd)
				}
			},
			'switchlayerinput': {
				name: 'Switch Layer Input',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				},{
					type: 'dropdown',
					label: 'Preview/Program',
					id: 'pvwpgm',
					default: '1',
					choices: [
						{ id: '1', label: 'Preview' },
						{ id: '0', label: 'Program' }
					]
				},{
					type: 'dropdown',
					label: 'Layer',
					id: 'layer',
					default: '1',
					choices: [
						{ id: '0', label: 'Background' },
						{ id: '1', label: 'PiP Layer 1' },
						{ id: '2', label: 'PiP Layer 2' },
						{ id: '3', label: 'PiP Layer 3' },
						{ id: '4', label: 'PiP Layer 4' },
						{ id: '5', label: 'Logo Layer 1' },
						{ id: '6', label: 'Logo Layer 2' },
						{ id: '7', label: 'Audio Layer' }
					]
				},{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: '0',
					tooltip: "Choose the Input for background, PiPs and audio or choose the frame number for logo layers.",
					choices: [
						{ id: '0', label: 'No Input' },
						{ id: '1', label: 'In/Frame 1' },
						{ id: '2', label: 'In/Frame 2' },
						{ id: '3', label: 'In/Frame 3' },
						{ id: '4', label: 'In/Frame 4' },
						{ id: '5', label: 'In/Frame 5' },
						{ id: '6', label: 'In/Frame 6' },
						{ id: '7', label: 'In/Frame 7' },
						{ id: '8', label: 'In/Frame 8' },
						{ id: '9', label: 'In/Frame 9' },
						{ id: '10', label: 'In/Frame 10' },
						{ id: '11', label: 'Matte' }
					]
				}],
				callback: (action) => {
					const cmd = action.options.screen + ','
						+ action.options.pvwpgm + ','
						+ action.options.layer + ','
						+ action.options.input + 'PRinp\n'
						+ action.options.screen + ',1PUscu'
					self.sendcmd(cmd)
				}
			},
			'1GCsba': {
				name: 'Reload last Preset',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				}],
				callback: actionCallback
			},
			'1GCrpr': {
				name: 'Reload Program to Preview',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				}],
				callback: actionCallback
			},
			'GCfsc': {
				name: 'Freeze Screen (all layers)',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				},{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Unfrozen' },
						{ id: '1', label: 'Frozen' }
					]
				}],
				callback: actionCallback
			},
			'GCfra': {
				name: 'Freeze all screens (all layers)',
				options: [{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Unfrozen' },
						{ id: '1', label: 'Frozen' }
					]
				}],
				callback: actionCallback
			},
			'INfrz': {
				name: 'Freeze Input',
				options: [{
					type: 'dropdown',
					label: 'Input',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: '1' },
						{ id: '1', label: '2' },
						{ id: '2', label: '3' },
						{ id: '3', label: '4' },
						{ id: '4', label: '5' },
						{ id: '5', label: '6' },
						{ id: '6', label: '7' },
						{ id: '7', label: '8' },
						{ id: '8', label: '9' },
						{ id: '9', label: '10' }
					]
				},{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Unfrozen' },
						{ id: '1', label: 'Frozen' }
					]
				}],
				callback: actionCallback
			},
			'GCfrl': {
				name: 'Freeze Layer',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				},{
					type: 'dropdown',
					label: 'Layer',
					id: '1',
					default: '1',
					choices: [
						{ id: '0', label: 'Background' },
						{ id: '1', label: 'PiP Layer 1' },
						{ id: '2', label: 'PiP Layer 2' },
						{ id: '3', label: 'PiP Layer 3' },
						{ id: '4', label: 'PiP Layer 4' },
						{ id: '5', label: 'Logo Layer 1' },
						{ id: '6', label: 'Logo Layer 2' },
						{ id: '7', label: 'Audio Layer' }
					]
				},{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Unfrozen' },
						{ id: '1', label: 'Frozen' }
					]
				}],
				callback: actionCallback
			},
			'INplg': {
				name: 'Switch Input Plug',
				options: [{
					type: 'dropdown',
					label: 'Input',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: '1' },
						{ id: '1', label: '2' },
						{ id: '2', label: '3' },
						{ id: '3', label: '4' },
						{ id: '4', label: '5' },
						{ id: '5', label: '6' },
						{ id: '6', label: '7' },
						{ id: '7', label: '8' },
						{ id: '8', label: '9' },
						{ id: '9', label: '10' }
					]
				},{
					type: 'dropdown',
					label: 'Plug',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Analog (HD-15)' },
						{ id: '1', label: 'DVI' },
						{ id: '2', label: 'SDI' },
						{ id: '3', label: 'HDMI' },
						{ id: '4', label: 'HDBaseT' }
					]
				}],
				callback: actionCallback
			},
			'CTqfa': {
				name: 'Quick Frame single screen',
				tooltip: "This command doesn't sync with Quick frame for all screens!",
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				},{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Quick Frame Off' },
						{ id: '1', label: 'Quick Frame On' }
					]
				}],
				callback: actionCallback
			},
			'CTqfl': {
				name: 'Quick Frame all screens',
				tooltip: "This command doesn't sync with Quick frame for a single screen!",
				options: [{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Quick Frame Off' },
						{ id: '1', label: 'Quick Frame On' }
					]
				}],
				callback: actionCallback
			},
			'GCply': {
				name: 'Preview Layer',
				tooltip: 'Midra devices can only show one layer with the correct source. Here you can select which one.',
				options: [{
					type: 'dropdown',
					label: 'Layer',
					id: 'value',
					default: '1',
					choices: [
						{ id: '0', label: 'Background' },
						{ id: '1', label: 'PiP Layer 1' },
						{ id: '2', label: 'PiP Layer 2' },
						{ id: '3', label: 'PiP Layer 3' },
						{ id: '4', label: 'PiP Layer 4' },
						{ id: '5', label: 'Logo Layer 1' },
						{ id: '6', label: 'Logo Layer 2' },
						{ id: '7', label: 'Audio Layer' }
					]
				}],
				callback: actionCallback
			}
		})
	}

	sendcmd(cmd) {
		let self = this

		if (cmd !== undefined) {

			if (self.socket === undefined) {
				self.init_tcp()
			}

			self.log('debug', 'sending tcp ' + cmd + " to " + self.config.host)

			if (self.socket !== undefined && self.socket.isConnected) {
				self.socket.send(cmd)
			} else {
				self.log('debug', 'Socket not connected :(')
			}

		}
	}
}

runEntrypoint(MidraInstance, [])
