#!/usr/bin/perl

# Generates html-model.js based on the HTML 4 DTD.  The HTML document model
# is required by Marginalia so that it can distinguish between block-level
# and inline elements (this is essential for determining word breaks, 
# among other things).  The inline/block distinction is hard-coded here -
# it should come from the DTD.  What *does* come from the DTD is information
# about what elements are allowed as children of other elements.  Without this,
# marginlia cannot correctly place highlight markers (for example, <em>
# markers must not be inserted within a <script> element).

%tagInfo = (
'a' => ( model => 'inline' ),
'abbr' => 'inline',
'acronym' => 'inline',
'address' => 'inline',
'b' => 'inline',
'big' => 'inline',
'body' => 'block',
'blockquote' => 'block',
'br' => 'block',
'button' => 'block',
'caption' => 'block',
'cite' => 'inline',
'code' => 'inline',
'col' => 'block',
'colgroup' => 'block',
'dd' => 'block',
'del' => 'inline',
'dfn' => 'inline',
'dir' => 'block',
'div' => 'block',
'dl' => 'block',
'dt' => 'block',
'em' => 'inline',
'fieldset' => 'block',
'font' => 'inline',
'form' => 'block',
'h1' => 'block',
'h2' => 'block',
'h3' => 'block',
'h4' => 'block',
'h5' => 'block',
'h6' => 'block',
'hr' => 'block',
'html' => 'block',
'i' => 'inline',
'iframe' => 'block',
'img' => 'inline',
'input' => 'block',
'ins' => 'inline',
'isindex' => 'block',
'kbd' => 'inline',
'label' => 'block',
'legend' => 'block',
'li' => 'block',
'menu' => 'block',
'object' => 'block',
'ol' => 'block',
'optgroup' => 'block',
'option' => 'block',
'p' => 'block',
'pre' => 'block',
'q' => 'inline',
's' => 'inline',
'samp' => 'inline',
'script' => 'none',
'select' => 'block',
'small' => 'inline',
'span' => 'inline',
'strike' => 'inline',
'strong' => 'inline',
'style' => 'none',
'sub' => 'inline',
'sup' => 'inline',
'table' => 'block',
'tbody' => 'block',
'td' => 'block',
'textarea' => 'block',
'tfoot' => 'block',
'th' => 'block',
'thead' => 'block',
'tr' => 'block',
'tt' => 'inline',
'u' => 'inline',
'ul' => 'block'
);

while ( <> )
{
	if ( $inElement )
	{
		$content .= $_;
		if ( />/ ) {
			$inElement = 0;
			doElement( $name, $content );
		}
	}
	elsif ( $inEntity )
	{
		$value .= $_;
		if ( />/ ) {
			$inEntity = 0;
			doEntity( $name, $value );
		}
	}
	elsif ( /<!ELEMENT\s+(\S+)\s+(.*)$/ )
	{
		( $name, $content ) = ( $1, $2 );
		if ( />/ ) {
			doElement( $name, $content );
		}
		else {
			$inElement = 1;
		}
	}
	elsif ( /<!ENTITY\s+\%\s+([a-zA-Z0-9\.]+)\s+(.*)$/ )
	{
		( $name, $value ) = ( $1, $2 );
		if ( />/ ) {
			doEntity( $name, $value );
		}
		else {
			$inEntity = 1;
		}
	}
}

findElementEntities( );
expandElementNames( );
for $name ( keys %elements ) {
	$elements{ $name } = cleanupContent( $elements{ $name } );
}

# Now write out Javascript encoding this structure
$first = 1;
print "HTML_CONTENT_MODEL = {\n";
for $name ( sort keys %elementEntities )  {
	if ( ! $first ) {
		print ", ";
	}
	else {
		$first = 0;
	}
	print "\n";	
	printElement( $name, $elementEntities{ $name } );
}

for $name ( sort keys %elements )  {
	print ",\n";
	printElement( $name, $elements{ $name } );
}
print "}\n";

sub printElement
{
	my( $name, $content ) = @_;
	my( @contents, $i, $tag );

	@contents = split( / /, $content );
	print "'$name': { ";
	if ( $name !~ /^\%/ )
	{
		if ( $displayModels{ $name } ) {
			print "model: '" . $displayModels{ $name } . "', ";
		}
		else {
			print "model: 'unknown', ";
		}
	}
	print "content: { ";
	for ( $i = 0;  $i <= $#contents;  ++$i )  {
		$tag = $contents[ $i ];
		print "," if $i > 0;
		print " '$tag': 1";
	}
	print "} }";
	#print $element . ': ' . $elements{ $element } . "\n";	
}

sub doElement
{
	my( $name, $content ) = @_;
	$name =~ tr/A-Z/a-z/;
	$content =~ s/--.*$//;
	$content =~ s/[-\+\*\(\)\|\?,]>/ /g;
	$content =~ s/ O / /g;
	$content =~ s/^O / /g;
	$content =~ s/\s+/ /g;
	$elements{ $name } = $content;
}

sub doEntity
{
	my( $name, $value ) = @_;
	$value =~ s/-- .* --//;
	( $value ) = $value =~ /\"([^\"]+)\"/;
	$entities{ $name } = $value;
}

sub findElementEntities
{
	my( $name, $content, $match );
	for $name ( keys %elements )  {
		$content = $elements{ $name };
		while ( $content =~ /\%([a-zA-Z\.]+);/ )  {
			$match = $1;
			$elementEntities{ '%'.$match } = cleanupContent( expandEntity( $match ) );
			$content =~ s/\%${match};/ /;
		}
	}
}

sub expandElementNames
{
	my( $done, $name, $newName, $names, $entityName, $newName );

	# if an element name is an entity reference, expand it
	do  # inefficient. don't care.
	{
		$done = 1;
		for $name ( keys %elements )  {
			$newName = $name;
			while ( 1 ) {
				if ( $newName =~ /\%([a-zA-Z0-9\.]+);/ )  {
					$entityName = $1;	
					$names = expandEntity( $entityName );
					$names =~ tr/A-Z/a-z/;
					$elements{ $names } = $elements{ $name };
					$newName =~ s/\%${entityName};/ /;
					$delete = 1;
				}
				else {
					last;
				}
			}
			if ( $name != $newName ) {
				delete $elements{ $name };
			}
		}
	}
	while ( ! $done );
	
	# if an element has multiple names, duplicate to multiple rows
	for $name ( keys %elements ) {
		$newName = $name;
		$newName =~ s/[\|\(\)]/ /g;
		if ( $newName =~ / / )  {
			@names = split( / /, $newName );
			for $newName ( @names ) {
				$elements{ $newName } = $elements{ $name };
			}
			# delete the original unexpanded reference
			delete $elements{ $name };
		}
	}
}

# expand entities on an as-needed basis
# otherwise, doing it all at once explodes the schema size, consequently memory and time usage
sub expandEntity
{
	my( $name ) = @_;
	my( $done, $content, $value );
	
	do	# inefficient. don't care.
	{
		$done = 1;
		$content = $entities{ $name };
		if ( $content =~ /\%([a-zA-Z0-9\.]+);/ ) {
			$entityName = $1;
			$value = $entities{ $entityName };
			$content =~ s/\%${entityName};/${value}/;
			$entities{ $name } = $content;
			$done = 0;
		}
	}
	while ( ! $done );

	$content = $entities{ $name };
	$content =~ s/\|\(\)\+\*/ /g;
	$content =~ s/\s+/ /g;
	$entities{ $name } = $content;
	
	$content;
}

sub cleanupContent
{
	my( $content ) = @_;
	$content =~ s/--.*$//;
	$content =~ s/>//;
	$content =~ tr/A-Z/a-z/;
	$content =~ s/[-\+\*\(\)\|\?,;]/ /g;
	$content =~ s/ o / /g;
	$content =~ s/^o / /g;
	$content =~ s/\s+/ /g;
	$content =~ s/\bempty\b//g;
	$content =~ s/^\s+//;
	$content =~ s/\s+$//;
	$content;
}
