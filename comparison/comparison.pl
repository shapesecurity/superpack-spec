use JSON::Parse qw(parse_json);
use Sereal qw(encode_sereal); 
use IO::Compress::Gzip qw(gzip $GzipError);

my $file = 'node_modules/public-domain-nypl-captures/data/pd_items.ndjson';

my @data = ();

open my $fd, $file
  or die "Could not open $file: $!";
while (my $line = <$fd>)  {
  my $json = parse_json $line
    or die "Could not parse JSON: $!";
  push @data, $json;
  last if $. >= 1000;
}
close $fd;

my $encoded = encode_sereal(\@data);
my $status = gzip \$encoded => \$compressed
        or die "gzip failed: $GzipError\n";

print "Sereal: ";
print length $encoded;
print "B; after gzip: ";
print length $compressed;
print "B\n";
