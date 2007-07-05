/*
 * range-test.js
 *
 * Marginalia has been developed with funding and support from
 * BC Campus, Simon Fraser University, and the Government of
 * Canada, and units and individuals within those organizations.
 * Many thanks to all of them.  See CREDITS.html for details.
 * Copyright (C) 2005-2007 Geoffrey Glass www.geof.net
 * 
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 *
 * $Id$
 */
 
function test()
{
	var frame = new TestFrame( );
	var rel = document.getElementById( 'word-data' );

	var conversionData = [
		[ 'p1.1.0;p1.1.1',		'/1/1.0;/1/1.1',	'o',			'first character'			],
		[ 'p1.1.0;p1.1.3',		'/1/1.0;/1/1.3',	'one',			'word alone in block'		],
		[ 'p2.1.0;p2.1.5',		'/2/1.0;/2/1.3',	'two',			'following space'			],
		[ 'p2.1.5;p2.1.10',		'/2/2.0;/2/2.5',	'three',		'spaces'					],
		[ 'p3.1.0;p3.1.6',		'/3/1.0;/3/1.4',	'four',			'spaces at either end'		],
		[ 'em1.1.0;em1.1.4',	'/3/2.0;/3/2.4',	'five',			'non-breaking element'		],
		[ 'p3.1.6;em1.1.4',		'/3/2.0;/3/2.4',	'five',			'cross em start boundary'	],
		[ 'em1.1.0;p3.3.0',		'/3/2.0;/3/2.4',	'five',			'cross em end boundary'	],
		[ 'em2.1.0;em3.1.5',	'/4/1.0;/4/1.10',	'sevenseven',	'cross em end/start'		],
		[ 'p1.1.0;p2.1.4',		'/1/1.0;/2/1.3',	'one two',		'span paragraphs'			]
	];

	for ( var i = 0;  i < conversionData.length;  ++i )
	{
		var row = conversionData[ i ];
		frame.addTest( new RangeConversion_Test( rel, row[0], row[1], row[2], row[3] ) );
	}

	frame.runAllTests( );
}

function RangeConversion_Test( rel, textRangeStr, sequenceRangeStr, quote, message )
{
	this.description = 'Range Conversion:  TextRange(' + textRangeStr + ') SequenceRange(' + sequenceRangeStr + ')';
	
	this.rel = rel;
	this.message = message;
	
	this.textRange = new TextRange( );
	this.textRange.fromString( textRangeStr );

	this.sequenceRange = new SequenceRange( );
	this.sequenceRange.fromString( sequenceRangeStr );

	return this;
}

RangeConversion_Test.prototype.runTest = function( frame )
{
	var wordRange = new WordRange( );
	wordRange.fromTextRange( this.textRange, this.rel, null );
	var sequenceRange = wordRange.toSequenceRange( this.rel ); 
	var r = sequenceRange.equals( this.sequenceRange );
	frame.passfail( this, 'TextRange to WordRange', r );
	
	wordRange.fromSequenceRange( this.sequenceRange, this.rel, null );
	var textRange = new TextRange( );
	textRange.fromWordRange( wordRange );
	var wordRange2 = new WordRange( );
	wordRange2.fromTextRange( this.textRange, this.rel, null );
	r = wordRange.equals( wordRange2 );
	frame.passfail( this, 'WordRange to TextRange', r );
}

TextRange.prototype.fromString = function( str )
{
	var points = str.split( ';' );
	
	// Get the start point
	var parts = points[ 0 ].split( '.' );
	var element = document.getElementById( parts[ 0 ] );
	var childIndex = Number( parts[ 1 ] ) - 1;
	this.startContainer = element.childNodes[ childIndex ];
	this.startOffset = Number( parts[ 2 ] )
	
	// Get the end point
	parts = points[ 1 ].split( '.' );
	element = document.getElementById( parts[ 0 ] );
	childIndex = Number( parts[ 1 ] ) - 1;
	this.endContainer = element.childNodes[ childIndex ];
	this.endOffset = Number( parts[ 2 ] );
}

