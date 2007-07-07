function parseRangeInfoXml( xmldoc )
{
	var listElement = xmldoc.documentElement;
	if ( listElement.tagName != 'range-infos' )
		return null;
	
	var infoArray = new Array();
	for ( var blockElement = listElement.firstChild;  blockElement;  blockElement = blockElement.nextSibling )
	{
		if ( ELEMENT_NODE == blockElement.nodeType && 'range-info' == blockElement.tagName )
		{
			var info = new RangeInfo( );
			info.fromXml( blockElement );
			infoArray[ infoArray.length ] = info;
		}
	}
	return infoArray;
}

function RangeInfo( xpathRange, sequenceRange )
{
	this.users = new Array();
	this.xpathRange = xpathRange;
	this.sequenceRange = sequenceRange;
	this.url = null;
}

RangeInfo.prototype.resolveStart = function( root )
{
	if ( this.xpathRange && this.xpathRange.start)
		return this.xpathRange.start.getReferenceElement( root );
	else
		return this.sequenceRange.start.getReferenceElement( root );
}

RangeInfo.prototype.fromXml = function( blockElement )
{
	this.url = blockElement.getAttribute( 'url' );
	for ( var node = blockElement.firstChild;  node;  node = node.nextSibling )
	{
		if ( ELEMENT_NODE == node.nodeType)
		{
			if ( 'range' == node.tagName )
			{
				var format = node.getAttribute( 'format' );
				if ( 'xpath' == format )
					this.xpathRange = new XPathRange( getNodeText( node ) );
				else if ( 'sequence' == format )
					this.sequenceRange = new SequenceRange( getNodeText( node ) );
			}
			else if ( 'user' == node.tagName )
			{
				this.users[ this.users.length ] = new UserInfo( );
				this.users[ this.users.length - 1 ].fromXml( node );
			}
		}
	}
}

function UserInfo( userid, noteCount, editCount )
{
	this.userid = userid;
	this.noteCount = noteCount;
	this.editCount = editCount;
	return this;
}

UserInfo.prototype.fromXml = function( userElement )
{
	this.userid = getNodeText( userElement );
	this.noteCount = Number( userElement.getAttribute( 'notes', 0 ) );
	this.editCount = Number( userElement.getAttribute( 'edits', 0 ) );
}
