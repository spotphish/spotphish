# phishTestDB
# key is ce089c6ec95d4ee33cd0cf0019a3ee5aca93048e20a4c41960c68ec45b173ae1
require 'json'
require 'open-uri'
require 'csv'
require 'fileutils'
# key = "ce089c6ec95d4ee33cd0cf0019a3ee5aca93048e20a4c41960c68ec45b173ae1"
# source = "https://data.phishtank.com/data/#{key}/online-valid.csv"

source = "https://data.phishtank.com/data/online-valid.csv"

download = open(source)
IO.copy_stream(download, 'phish_tank_db.csv')
customers = CSV.read('phish_tank_db.csv')
# puts customers.count

DEFAULT_SEARCH = ["Facebook", "PayPal", "Dropbox", "Google", "Amazon.com" ]
PHISHTANK_IMG_URL = "https://d1750zhbc38ec0.cloudfront.net"
facebook = []
paypal = []
dropbox = []
google = []
amazon = []
MAIN_PATH = "screenshots"

# Download image and save
def download_image(url, dest)
  begin
    puts "Downloading... #{url}"
    open(url) do |u|
      File.open(dest, 'wb') { |f| f.write(u.read) }
    end
  rescue Exception => e
    puts "Error"
    puts e.message
  end

end

# iterate all phish tanks ids and get all images.
CSV.foreach('phish_tank_db.csv') do |row|
    d = {}
    if DEFAULT_SEARCH.include? row[-1]
       Dir.mkdir(MAIN_PATH) unless File.exists?(MAIN_PATH)
       if !File.exists?("#{MAIN_PATH}/#{row[-1].downcase}")
         Dir.mkdir("#{MAIN_PATH}/#{row[-1].downcase}")
       end
      if !File.exist? "#{MAIN_PATH}/#{row[-1].downcase}/#{row[0]}.jpg"
        download_image("#{PHISHTANK_IMG_URL}/#{row[0]}.jpg", "#{MAIN_PATH}/#{row[-1].downcase}/#{row[0]}.jpg" )
      end
    end
end

# data = [{ "name" => "Facebook", "ids" => facebook}, {"name" => "PayPal", "ids" => paypal} , {"name" => "Google", "ids" => google}, {"name" => "Dropbox", "ids" => dropbox},  {"name" => "Amazon", "ids" => amazon}]
#
data = CSV.read('phish_tank_db.csv', headers:true, header_converters: :symbol, converters: :all).collect do |row|
  Hash[row.collect { |c,r| [c,r] }]
end

targets = data.collect{|s| s[:target]}.uniq
stat_data = []

targets.each do |d|
  s = {}
  s[:name] =  d
  s[:count] = data.select{|k| k[:target] == d }.count
  stat_data.push s
end

stat_data.sort_by!{|s| - s[:count]}
stat_data = stat_data
File.open("phishtank_stats_#{Time.now.strftime('%Y%m%d')}.json", "w") do |f|
   f.write(JSON.pretty_generate(stat_data))
end
