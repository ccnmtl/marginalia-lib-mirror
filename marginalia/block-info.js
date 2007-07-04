function parseBlockInfoXml( xmldoc )
{
	var listElement = xmldoc.documentElement;
	if ( listElement.tagName != 'block-info' )
		return null;
	
	var blockInfoArray = new Array();
	for ( var blockElement = listElement.firstChild;  blockElement;  blockElement = blockElement.nextSibling )
	{
		if ( ELEMENT_NODE == blockElement.nodeType && 'block' == blockElement.tagName )
		{
			var info = new BlockInfo( );
			info.fromXml( blockElement );
			blockInfoArray[ blockInfoArray.length ] = info;
		}
	}
	return blockInfoArray;
}

function BlockInfo( xpathRange, sequenceRange )
{
	this.users = new Array();
	this.xpathRange = xpathRange;
	this.sequenceRange = sequenceRange;
	this.url = null;
}

BlockInfo.prototype.resolveStart = function( root )
{
	if ( this.xpathRange && this.xpathRange.start)
		return this.xpathRange.start.getReferenceElement( root );
	else
		return this.sequenceRange.start.getReferenceElement( root );
}

BlockInfo.prototype.fromXml = function( blockElement )
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
				this.users[ this.users.length ] = getNodeText( node );
		}
	}
}

