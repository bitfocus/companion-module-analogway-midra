var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	this.firmwareVersion = "0";
	this.numOutputs = 0;
	this.numInputs = 0;
	this.modelnum;
	this.modelname = '';

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}


instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.init_tcp();
};

instance.prototype.init_tcp = function() {
	var self = this;
	var receivebuffer = '';

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, 10600);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			debug("Connected");
			self.sendcmd("*");
		});

		// separate buffered stream into lines with responses
		self.socket.on('data', function (chunk) {
			var i = 0, line = '', offset = 0;
			receivebuffer += chunk;
			while ( (i = receivebuffer.indexOf('\r\n', offset)) !== -1) {
				line = receivebuffer.substr(offset, i - offset);
				offset = i + 1;
				self.socket.emit('receiveline', line.toString());
			}
			receivebuffer = receivebuffer.substr(offset);
		});

		self.socket.on('receiveline', function (line) {
			debug("Received line from Midra:", line);

			if (line.match(/\*1/)) {
				self.log('info',"Ethernet connection to "+ self.config.label +" established. Device ready.");
				self.sendcmd("?");
			}
			if (line.match(/DEV\d+/)) {
				this.model = parseInt(line.match(/DEV(\d+)/)[1]);
				switch (this.model) {
					case 257: this.modelname = 'Eikos2'; break;
					case 258: this.modelname = 'Saphyr'; break;
					case 259: this.modelname = 'Pulse2'; break;
					case 260: this.modelname = 'SmartMatriX2'; break;
					case 261: this.modelname = 'QuickMatriX'; break;
					case 262: this.modelname = 'QuickVu'; break;
					case 282: this.modelname = 'Saphyr - H'; break;
					case 283: this.modelname = 'Pulse2 - H'; break;
					case 284: this.modelname = 'SmartMatriX2 - H'; break;
					case 285: this.modelname = 'QuickMatriX - H'; break;
					default: this.modelname = 'unknown'; break;
				}
				self.log('info', self.config.label +" Type is "+ this.modelname);
				self.sendcmd("VEvar");
			}

			if (line.match(/VEvar\d+/)) {
				var commandSetVersion = parseInt(line.match(/VEvar(\d+)/)[1]);
				self.log('info', "Command set version of " + self.config.label +" is " + commandSetVersion);
				// TODO: Should check the machine state now, will be implemented after feedback system is done
			}

			if (line.match(/#0/)) {
				//There is no parameter readback runnning, it can be started now
			}


			if (line.match(/E\d{2}/)) {
				switch (parseInt(line.match(/E(\d{2})/)[1])) {
					case 10: self.log('error',"Received command name error from "+ self.config.label +": "+ line); break;
					case 11: self.log('error',"Received index value out of range error from "+ self.config.label +": "+ line); break;
					case 12: self.log('error',"Received index count (too few or too much) error from "+ self.config.label +": "+ line); break;
					case 13: self.log('error',"Received value out of range error from "+ self.config.label +": "+ line); break;
					default: self.log('error',"Received unspecified error from Midra "+ self.config.label +": "+ line);
				}
			}

		});

	}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;

	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'IP-Adress of Midra Unit',
			width: 6,
			default: '192.168.2.140',
			regex: self.REGEX_IP,
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
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	debug("destroy", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {
				/*
				 	Note: For self generating commands use option ids 0,1,...,5 and 'value'.
					The command will be of the form [valueof0],[valueof1],...[valueof5],[valueofvalue][CommandID]
					for set-commands you need a value, for get-commands you mustn't have a value
					for simple commands the value can be hardcoded in the CommandID, like "1SPtsl".
				*/
		'1GCtal': {
			label: 'Take all'
		},
		'takescreen': {
			 label: 'Take single screen',
			 options: [{
				type: 'dropdown',
 				label: 'Screen',
 				id: 'screen',
 				default: '0',
 				choices: [
					{ id: '0', label: 'S1' },
					{ id: '1', label: 'S2' }
				]
			}]},
		'loadpreset': {
			label: 'Load Memory',
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
				id: 'pgmpvw',
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
			}]},
		'switchlayerinput': {
			label: 'Switch Layer Input',
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
					{ id: '9', label: 'In/Frame 10' },
					{ id: '9', label: 'Matte' }
				]
			}]},
		'1GCsba': {
			 label: 'Reload last Preset',
			 options: [{
				type: 'dropdown',
 				label: 'Screen',
 				id: '0',
 				default: '0',
 				choices: [
					{ id: '0', label: 'S1' },
					{ id: '1', label: 'S2' }
				]
			}]},
		'1GCrpr': {
			 label: 'Reload Program to Preview',
			 options: [{
				type: 'dropdown',
 				label: 'Screen',
 				id: '0',
 				default: '0',
 				choices: [
					{ id: '0', label: 'S1' },
					{ id: '1', label: 'S2' }
				]
			}]},
		'GCfsc': {
			 label: 'Freeze Screen (all layers)',
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
			}]},
		'GCfra': {
			 label: 'Freeze all screens (all layers)',
			 options: [{
				type: 'dropdown',
 				label: 'Status',
 				id: 'value',
 				default: '0',
 				choices: [
					{ id: '0', label: 'Unfrozen' },
					{ id: '1', label: 'Frozen' }
				]
			}]},
		'INfrz': {
			 label: 'Freeze Input',
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
			}]},
		'GCfrl': {
			 label: 'Freeze Layer',
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
			}]},
		'INplg': {
			 label: 'Switch Input Plug',
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
			}]},
		'CTqfa': {
			 label: 'Quick Frame single screen',
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
			}]},
		'CTqfl': {
			 label: 'Quick Frame all screens',
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
			}]},
		'GCply': {
			 label: 'Preview Layer',
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
			}]}
	});
}

instance.prototype.action = function(action) {
	var self = this;
	var cmd = '';

	switch(action.action) {

	case 'takescreen':
		cmd = '' + action.options.screen + ',1GCtak';
		break;


	case 'loadpreset':

		if (action.options.sourcescreen == '0') {
			cmd = '0,';
		} else {
			cmd = '1,';
		}

		cmd += '' + (parseInt(action.options.memory)-1) + ',';

		if (action.options.destscreen == '0') {
			cmd += '0,';
		} else {
			cmd += '1,';
		}

		if (action.options.pvwpgm == '0') {
			cmd += '0,';
		} else {
			cmd += '1,';
		}

		var filterval = 0;
		if (action.options.filter1 == '1') filterval += 1;
		if (action.options.filter2 == '1') filterval += 2;
		if (action.options.filter4 == '1') filterval += 4;
		if (action.options.filter8 == '1') filterval += 8;
		if (action.options.filter16 == '1') filterval += 16;
		if (action.options.filter32 == '1') filterval += 32;
		if (action.options.filter64 == '1') filterval += 64;
		if (action.options.filter128 == '1') filterval += 128;
		if (action.options.filter256 == '1') filterval += 256;
		if (action.options.filter512 == '1') filterval += 512;

		cmd += filterval + ',1GClrq';
		break;

	case 'switchlayerinput':
		cmd = action.options.screen + ',' + action.options.pvwpgm + ',' + action.options.layer + ',' + action.options.input + 'PRinp\n' + action.options.screen + ',1PUscu'
		break;

	default:
		cmd = '';
		if (action.options) {
			for (var i = 0; i<= 5; i++) {
				if (action.options.hasOwnProperty(i) && action.options[i] != '') {
					cmd += action.options[i] + ',';
				}
			}
			if (action.options.hasOwnProperty('value') && action.options['value'] != '') {
				cmd += action.options['value'];
			}
		}
		cmd += action.action;
		break;
	}
	self.sendcmd(cmd);
};


instance.prototype.sendcmd = function(cmd) {
	var self = this;

	if (cmd !== undefined) {

		if (self.socket === undefined) {
			self.init_tcp();
		}

		// TODO: remove this when issue #71 is fixed
		if (self.socket !== undefined && self.socket.host != self.config.host) {
			self.init_tcp();
		}

		debug('sending tcp',cmd,"to",self.config.host);

		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(cmd);
		} else {
			debug('Socket not connected :(');
		}

	}
};


instance.module_info = {
	label: 'Analog Way Midra',
	id: 'analogway_midra',
	version: '0.1.0'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
