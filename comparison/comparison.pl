use JSON::Parse qw(json_file_to_perl);
use Sereal qw(encode_sereal); 
use IO::Compress::Gzip qw(gzip $GzipError);

my $data = json_file_to_perl('data.json');
my $encoded = encode_sereal($data);
my $status = gzip \$encoded => \$compressed
        or die "gzip failed: $GzipError\n";

print "Sereal: ";
print length $encoded;
print "B; after gzip: ";
print length $compressed;
print "B\n";
